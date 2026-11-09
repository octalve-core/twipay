/** Offline behavioral tests for ISS-018 (idempotency keys left behind by a dead process) and ISS-019 (a bookkeeping error after a
 * successful provider call was recorded as an unknown provider outcome). Real service code against in-memory seams; NOT
 * PostgreSQL or provider qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = resolve(import.meta.dirname, '../../..');

function load(rel, dependencies) {
  const js = ts.transpileModule(readFileSync(resolve(root, rel), 'utf8'), { fileName: rel, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', js)((id) => {
    if (!(id in dependencies)) throw new Error(`Unexpected dependency ${id}`);
    return dependencies[id];
  }, mod, mod.exports);
  return mod.exports;
}

class ApiError extends Error { constructor(payload) { super(payload.code); this.code = payload.code; } }
const nest = { Injectable: () => (klass) => klass, ConflictException: ApiError, Logger: class { error(entry) { nest.logged.push(entry); } }, logged: [] };

// ---------------------------------------------------------------- IdempotencyService (ISS-018)

const idempotencyModule = load('apps/api/src/modules/finance/application/idempotency.service.ts', {
  'node:crypto': require('node:crypto'),
  '@nestjs/common': nest,
  '@twipay/security': { decryptSensitiveString: (value) => value, encryptSensitiveString: (value) => value },
  '@twipay/ledger': { validateIdempotencyKey: (key) => key },
  '../../../platform/database/prisma.service.js': {},
});
const { IdempotencyService, STALE_PROCESSING_MS } = idempotencyModule;

const MINUTE = 60_000;
const ago = (ms) => new Date(Date.now() - ms);
const later = (ms) => new Date(Date.now() + ms);

function matches(row, where) {
  return Object.entries(where).every(([field, condition]) => {
    if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
      if ('lte' in condition) return row[field] <= condition.lte;
      if ('in' in condition) return condition.in.includes(row[field]);
    }
    return row[field] === condition;
  });
}

function fakeIdempotencyPrisma(rows) {
  let next = 1;
  return {
    rows,
    idempotencyRecord: {
      async deleteMany({ where }) {
        const before = rows.length;
        for (let index = rows.length - 1; index >= 0; index -= 1) if (matches(rows[index], where)) rows.splice(index, 1);
        return { count: before - rows.length };
      },
      async create({ data }) {
        if (rows.some((row) => row.userId === data.userId && row.scope === data.scope && row.key === data.key)) throw new Error('P2002 unique violation');
        const row = { id: `new-${next++}`, status: 'PROCESSING', resourceId: null, resourceType: null, responseStatus: null, responseBodyCiphertext: null, createdAt: new Date(), ...data };
        rows.push(row);
        return { id: row.id };
      },
      async findUnique({ where }) {
        const k = where.userId_scope_key;
        return rows.find((row) => row.userId === k.userId && row.scope === k.scope && row.key === k.key) ?? null;
      },
      async findMany({ where, take }) {
        return rows.filter((row) => matches(row, where)).sort((a, b) => a.expiresAt - b.expiresAt).slice(0, take).map((row) => ({ id: row.id }));
      },
    },
  };
}

const stuck = (over = {}) => ({ id: 'old', userId: 'u1', scope: 'funding:create', key: 'key-0123456789', requestHash: null, status: 'PROCESSING', resourceId: null, createdAt: ago(10 * MINUTE), expiresAt: later(23 * 60 * MINUTE), ...over });
const request = { amount: 100 };
const begin = (service, options = {}) => service.begin({ scope: 'funding:create', key: 'key-0123456789', userId: 'u1', request, ...options });

async function seeded(over) {
  const probe = fakeIdempotencyPrisma([]);
  const first = await begin(new IdempotencyService(probe));
  const hash = probe.rows.find((row) => row.id === first.recordId).requestHash; // the hash the service computes for `request`
  const rows = [stuck({ requestHash: hash, ...over })];
  return { rows, service: new IdempotencyService(fakeIdempotencyPrisma(rows)) };
}

test('ISS-018: a key abandoned before anything was committed is reclaimed instead of blocking until the TTL', async () => {
  const { rows, service } = await seeded();
  const started = await begin(service, { reclaimStale: true });
  assert.ok(started.recordId, 'the retry gets a fresh record');
  assert.equal(rows.filter((row) => row.id === 'old').length, 0, 'the dead holder is gone');
  assert.equal(rows.length, 1);
});

test('ISS-018: a young PROCESSING key is a live request and still answers 409', async () => {
  const { service } = await seeded({ createdAt: ago(STALE_PROCESSING_MS - MINUTE) });
  await assert.rejects(begin(service, { reclaimStale: true }), { code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS' });
});

test('ISS-018: a stale key with a resource attached is never reclaimed (money state exists, reconciliation owns it)', async () => {
  const { rows, service } = await seeded({ resourceId: 'financial-1' });
  await assert.rejects(begin(service, { reclaimStale: true }), { code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'old');
});

test('ISS-018: reclaiming is opt-in, so flows with a one-time provider step (KYC OTP) keep the old behaviour', async () => {
  const { rows, service } = await seeded();
  await assert.rejects(begin(service), { code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS' });
  assert.equal(rows[0].id, 'old');
});

test('ISS-018: the same key with a different request is still refused, stale or not', async () => {
  const { service } = await seeded({ requestHash: 'f'.repeat(64) });
  await assert.rejects(begin(service, { reclaimStale: true }), { code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST' });
});

test('ISS-018: purgeExpired removes expired rows only, oldest first, bounded by the limit', async () => {
  const rows = [
    stuck({ id: 'e1', key: 'k1', expiresAt: ago(3 * MINUTE) }),
    stuck({ id: 'e2', key: 'k2', expiresAt: ago(2 * MINUTE) }),
    stuck({ id: 'e3', key: 'k3', expiresAt: ago(1 * MINUTE) }),
    stuck({ id: 'live', key: 'k4', expiresAt: later(MINUTE) }),
  ];
  const service = new IdempotencyService(fakeIdempotencyPrisma(rows));
  assert.equal(await service.purgeExpired(2), 2);
  assert.deepEqual(rows.map((row) => row.id).sort(), ['e3', 'live']);
  assert.equal(await service.purgeExpired(2), 1);
  assert.deepEqual(rows.map((row) => row.id), ['live']);
  assert.equal(await service.purgeExpired(2), 0);
});

// ---------------------------------------------------------------- PaymentService.createCollection (ISS-019)

const { PaymentService } = load('apps/api/src/modules/finance/application/payment.service.ts', {
  '@nestjs/common': nest,
  'node:crypto': require('node:crypto'),
  '@twipay/security': { fingerprintSensitiveValue: () => 'fp' },
  '../../../platform/database/prisma.service.js': {},
  './financial-authorization.service.js': {},
  '../../providers/payment-provider.registry.js': {},
  './idempotency.service.js': {},
  './financial-transaction.service.js': {},
  './ledger.service.js': {},
  './wallet.service.js': {},
  './reference.js': { createFinancialReference: () => 'fund:ref_1' },
  './virtual-account-credit-destination.js': { resolveDepositDestination: () => ({ ok: false }) },
});

function harness({ providerFails = false, bookkeepingFailures = 0 } = {}) {
  const log = { operationUpdates: [], transitions: [], completed: [], reclaimStale: undefined };
  let transactions = 0;
  let financialStatus = 'AUTHORIZED';
  const tx = {
    providerOperation: {
      create: async () => ({ id: 'op-1' }),
      update: async ({ data }) => { log.operationUpdates.push(data); },
    },
    financialTransaction: { findUniqueOrThrow: async () => ({ status: financialStatus }) },
  };
  const prisma = {
    user: { findUniqueOrThrow: async () => ({ email: 'a@twipay.example', givenName: 'Ada', familyName: 'Obi', phoneE164: null }) },
    async $transaction(fn) {
      transactions += 1;
      if (transactions > 1 && !providerFails && transactions - 1 <= bookkeepingFailures) throw new Error('connection reset');
      return fn(tx);
    },
  };
  const financial = {
    createWithTx: async () => ({ id: 'fin-1' }),
    transitionWithTx: async (_tx, _id, status, reason) => { financialStatus = status; log.transitions.push({ status, reason }); },
    moveToProviderSubmittedWithTx: async () => {},
  };
  const provider = {
    createCollection: async () => {
      if (providerFails) throw new Error('timeout');
      return { providerReference: 'ps_123', status: 'PENDING', rawStatus: 'pending', checkoutUrl: 'https://checkout.paystack.com/x' };
    },
  };
  const idempotency = {
    begin: async (input) => { log.reclaimStale = input.reclaimStale; return { recordId: 'rec-1' }; },
    attachResource: async () => {},
    complete: async (id, status, body) => { log.completed.push({ id, status, body }); },
  };
  const service = new PaymentService(prisma, { assertCurrentWithTx: async () => {} }, { get: () => provider }, idempotency, financial, {}, { ensureUserWallet: async () => {} });
  const run = () => service.createCollection({ authorization: {}, userId: 'u1', idempotencyKey: 'twipay-fund:abc-123456', providerCode: 'paystack', amountMinor: 10_000n, currency: 'NGN' });
  return { run, log };
}

test('ISS-019: provider and bookkeeping both succeed: 201 with the checkout link and the provider reference stored', async () => {
  const h = harness();
  const result = await h.run();
  assert.equal(result.statusCode, 201);
  assert.equal(result.body.checkoutUrl, 'https://checkout.paystack.com/x');
  assert.equal(h.log.operationUpdates.at(-1).providerReference, 'ps_123');
  assert.ok(!h.log.transitions.some((t) => t.status === 'UNKNOWN'));
});

test('ISS-019: a transient database error after a successful provider call is retried and the customer still gets the checkout link', async () => {
  const h = harness({ bookkeepingFailures: 1 });
  const result = await h.run();
  assert.equal(result.statusCode, 201);
  assert.equal(result.body.checkoutUrl, 'https://checkout.paystack.com/x');
  assert.equal(h.log.operationUpdates.at(-1).providerReference, 'ps_123', 'the retry recorded the provider reference');
  assert.ok(!h.log.transitions.some((t) => t.status === 'UNKNOWN'));
});

test('ISS-019: when bookkeeping keeps failing the outcome is NOT recorded as unknown and the checkout link is not dropped', async () => {
  nest.logged.length = 0;
  const h = harness({ bookkeepingFailures: 2 });
  const result = await h.run();
  assert.equal(result.statusCode, 201);
  assert.equal(result.body.status, 'PENDING');
  assert.equal(result.body.checkoutUrl, 'https://checkout.paystack.com/x');
  assert.ok(!h.log.transitions.some((t) => t.status === 'UNKNOWN'), 'no UNKNOWN transition');
  assert.ok(!h.log.operationUpdates.some((d) => d.status === 'UNKNOWN'), 'the operation is not marked UNKNOWN');
  assert.equal(h.log.completed.at(-1).status, 201, 'a replay with the same key returns the same link');
  assert.equal(nest.logged.filter((entry) => entry.event === 'COLLECTION_BOOKKEEPING_FAILED').length, 2, 'both failures are logged with the references');
  assert.equal(nest.logged[0].providerReference, 'ps_123');
});

test('ISS-019: a provider call that throws is still recorded as an unknown outcome (202)', async () => {
  const h = harness({ providerFails: true });
  const result = await h.run();
  assert.equal(result.statusCode, 202);
  assert.equal(result.body.code, 'PROVIDER_OUTCOME_UNKNOWN');
  assert.ok(h.log.operationUpdates.some((d) => d.status === 'UNKNOWN'));
  assert.ok(h.log.transitions.some((t) => t.status === 'UNKNOWN' && t.reason === 'PROVIDER_CALL_OUTCOME_UNKNOWN'));
});

test('ISS-018: funding opts in to reclaiming abandoned keys', async () => {
  const h = harness();
  await h.run();
  assert.equal(h.log.reclaimStale, true);
});

test('ISS-018: only flows verified safe opt in; transfer, bill purchase and the KYC steps do not', () => {
  const read = (rel) => readFileSync(resolve(root, 'apps/api/src/modules', rel), 'utf8');
  for (const rel of ['events/application/event.service.ts', 'operations/application/organizer-payout.service.ts', 'operations/application/dispute-refund.service.ts', 'finance/application/payment.service.ts']) {
    assert.match(read(rel), /reclaimStale: true/, rel);
  }
  // Transfer and bill purchase commit a funds reservation before attachResource, and the KYC steps send a one-time code to the
  // provider: re-running either after a crash is not safe without orphan cleanup, so they keep the old behaviour.
  for (const rel of ['finance/application/transfer.service.ts', 'services/application/bill.service.ts', 'kyc/application/kyc.service.ts', 'finance/application/virtual-account.service.ts']) {
    assert.doesNotMatch(read(rel), /reclaimStale/, rel);
  }
});

test('ISS-018: the worker sweep purges expired idempotency keys', () => {
  const worker = readFileSync(resolve(root, 'apps/worker/src/main.ts'), 'utf8');
  assert.match(worker, /idempotency\.purgeExpired\(\)/);
  assert.match(readFileSync(resolve(root, 'apps/api/src/worker-entry.ts'), 'utf8'), /IdempotencyService/);
});
