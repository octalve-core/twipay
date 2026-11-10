/** Offline behavioral tests for ISS-017: a webhook event claimed as PROCESSING by a process that then died stayed PROCESSING for
 * ever, and the provider's redelivery was answered "duplicate" so it stopped retrying. Real WebhookService and real
 * encryption against an in-memory event table; NOT PostgreSQL or provider qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = resolve(import.meta.dirname, '../../..');

process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('base64');

function load(rel, dependencies) {
  const js = ts.transpileModule(readFileSync(resolve(root, rel), 'utf8'), { fileName: rel, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true } }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', js)((id) => {
    if (!(id in dependencies)) throw new Error(`Unexpected dependency ${id}`);
    return dependencies[id];
  }, mod, mod.exports);
  return mod.exports;
}

// The real encryption helpers; the package's MFA re-export is not needed here.
const security = load('packages/security/src/index.ts', { 'node:crypto': require('node:crypto'), './mfa.js': {} });
class Unauthorized extends Error { constructor(payload) { super(payload.code); this.code = payload.code; } }
const { WebhookService, STALE_WEBHOOK_CLAIM_MS, sealRecoveryPayload, openRecoveryPayload } = load('apps/api/src/modules/webhooks/application/webhook.service.ts', {
  'node:crypto': require('node:crypto'),
  '@nestjs/common': { Injectable: () => (klass) => klass, UnauthorizedException: Unauthorized },
  '@twipay/security': security,
  '../../../platform/database/prisma.service.js': {},
  '../../providers/payment-provider.registry.js': {},
  '../../finance/application/payment.service.js': {},
  '../../finance/application/transfer.service.js': {},
  '../../finance/application/virtual-account.service.js': {},
});

const MINUTE = 60_000;
const ago = (ms) => new Date(Date.now() - ms);
const KEY = process.env.DATA_ENCRYPTION_KEY;

function matches(row, where) {
  if (where.OR) return where.OR.some((branch) => matches(row, branch));
  return Object.entries(where).every(([field, condition]) => {
    if (condition === null) return row[field] === null || row[field] === undefined;
    if (condition instanceof Date) return row[field] instanceof Date && row[field].getTime() === condition.getTime();
    if (condition && typeof condition === 'object') {
      if ('in' in condition) return condition.in.includes(row[field]);
      if ('lt' in condition) return row[field] instanceof Date && row[field] < condition.lt;
    }
    return row[field] === condition;
  });
}

function row(over = {}) {
  return { id: `ev-${Math.random().toString(36).slice(2, 8)}`, providerCode: 'paystack', deduplicationKey: 'd'.repeat(64), eventType: 'charge.success', merchantReference: 'fund:ref_1', providerReference: null, status: 'PROCESSING', failureCode: null, receivedAt: ago(30 * MINUTE), processedAt: null, processingStartedAt: ago(10 * MINUTE), recoveryPayloadCiphertext: null, ...over };
}

function harness({ rows = [], verified, operations = { 'fund:ref_1': 'COLLECTION', 'payout:ref_2': 'PAYOUT' }, failOn = [] } = {}) {
  const calls = { collection: [], payout: [], credit: [], assignment: [], created: [], createData: [] };
  const fail = (key) => { if (failOn.includes(key)) throw new Error(`BOOM_${key}`); };
  const prisma = {
    webhookEvent: {
      async findUnique() { return rows[0] ? { ...rows[0] } : null; },
      async create({ data }) { calls.createData.push(data); const created = row({ status: 'VERIFIED', receivedAt: new Date(), processingStartedAt: null, ...data }); rows.unshift(created); calls.created.push({ ...created }); /* as stored at creation, before processing changes the row */ return { ...created }; },
      async updateMany({ where, data }) {
        const hit = rows.filter((r) => matches(r, where));
        for (const r of hit) Object.assign(r, data);
        return { count: hit.length };
      },
      async update({ where, data }) { Object.assign(rows.find((r) => r.id === where.id), data); },
      async findMany({ where, orderBy, take }) {
        return rows.filter((r) => matches(r, where)).sort((a, b) => a.receivedAt - b.receivedAt).slice(0, take).map((r) => ({ ...r }));
      },
    },
    providerOperation: { findUnique: async ({ where }) => { const ref = where.providerCode_merchantReference.merchantReference; return operations[ref] ? { type: operations[ref] } : null; } },
  };
  const service = new WebhookService(
    prisma,
    { get: () => ({ verifyWebhook: async () => verified }) },
    { verifyAndSettleCollection: async (_p, ref) => { fail(`collection:${ref}`); calls.collection.push(ref); }, verifyAndSettleVirtualAccountCredit: async (_p, credit) => { fail('credit'); calls.credit.push(credit); } },
    { verifyAndApplyPayout: async (_p, ref) => { fail(`payout:${ref}`); calls.payout.push(ref); } },
    { applyProviderAssignment: async (_p, assignment) => { calls.assignment.push(assignment); } },
  );
  return { service, rows, calls };
}

const delivery = (over = {}) => ({ providerCode: 'paystack', eventType: 'charge.success', externalEventId: 'evt-1', merchantReference: 'fund:ref_1', payloadHash: 'a'.repeat(64), normalizedPayload: {}, ...over });
const receive = (service) => service.receive('paystack', { rawBody: Buffer.from('{}'), headers: {}, sourceIp: '127.0.0.1' });

// ---------------------------------------------------------------- redelivery (the provider's retry)

test('ISS-017: a live PROCESSING claim is left alone: duplicate, nothing re-run', async () => {
  const h = harness({ rows: [row({ processingStartedAt: ago(MINUTE) })], verified: delivery() });
  assert.deepEqual(await receive(h.service), { accepted: true, duplicate: true, processing: true });
  assert.deepEqual(h.calls.collection, []);
  assert.equal(h.rows[0].status, 'PROCESSING');
});

test('ISS-017: a stale PROCESSING claim is taken over by the redelivery, processed and cleared', async () => {
  const h = harness({ rows: [row({ processingStartedAt: ago(STALE_WEBHOOK_CLAIM_MS + MINUTE), recoveryPayloadCiphertext: 'stale-ciphertext' })], verified: delivery() });
  const result = await receive(h.service);
  assert.deepEqual(result, { accepted: true, duplicate: false });
  assert.deepEqual(h.calls.collection, ['fund:ref_1']);
  assert.equal(h.rows[0].status, 'PROCESSED');
  assert.equal(h.rows[0].recoveryPayloadCiphertext, null, 'the encrypted copy is dropped once processed');
});

test('ISS-017: a row claimed before the column existed is judged by when it arrived', async () => {
  const stale = harness({ rows: [row({ processingStartedAt: null, receivedAt: ago(20 * MINUTE) })], verified: delivery() });
  assert.equal((await receive(stale.service)).duplicate, false);
  const young = harness({ rows: [row({ processingStartedAt: null, receivedAt: ago(MINUTE) })], verified: delivery() });
  assert.equal((await receive(young.service)).processing, true);
});

test('ISS-017: two deliveries racing for the same stale claim process it once', async () => {
  const h = harness({ rows: [row()], verified: delivery() });
  const [a, b] = await Promise.all([receive(h.service), receive(h.service)]);
  assert.deepEqual(h.calls.collection, ['fund:ref_1'], 'the handler ran exactly once');
  assert.equal([a, b].filter((r) => r.duplicate === false).length, 1);
  assert.equal([a, b].filter((r) => r.processing === true).length, 1);
});

test('ISS-017: a first delivery records when its claim began', async () => {
  const h = harness({ rows: [], verified: delivery() });
  const before = Date.now();
  await receive(h.service);
  assert.equal(h.calls.created.length, 1);
  assert.ok(h.rows[0].processingStartedAt.getTime() >= before, 'processingStartedAt is set when the event is claimed');
  assert.equal(h.rows[0].status, 'PROCESSED');
});

// ---------------------------------------------------------------- the sweep (when the provider does not retry)

test('ISS-017: the sweep recovers stale collection and payout events from the stored merchant reference', async () => {
  const rows = [
    row({ id: 'c', merchantReference: 'fund:ref_1' }),
    row({ id: 'p', merchantReference: 'payout:ref_2', status: 'VERIFIED', processingStartedAt: null, receivedAt: ago(20 * MINUTE) }),
  ];
  const h = harness({ rows });
  assert.equal(await h.service.recoverStale(), 2);
  assert.deepEqual(h.calls.collection, ['fund:ref_1']);
  assert.deepEqual(h.calls.payout, ['payout:ref_2']);
  assert.deepEqual(rows.map((r) => r.status), ['PROCESSED', 'PROCESSED']);
});

test('ISS-017: the sweep leaves live claims, fresh VERIFIED rows, FAILED and finished events alone', async () => {
  const rows = [
    row({ id: 'live', processingStartedAt: ago(MINUTE) }),
    row({ id: 'fresh', status: 'VERIFIED', processingStartedAt: null, receivedAt: ago(MINUTE) }),
    row({ id: 'failed', status: 'FAILED' }),
    row({ id: 'done', status: 'PROCESSED' }),
    row({ id: 'ignored', status: 'IGNORED' }),
  ];
  const h = harness({ rows });
  assert.equal(await h.service.recoverStale(), 0);
  assert.deepEqual(h.calls.collection, []);
  assert.deepEqual(rows.map((r) => r.status), ['PROCESSING', 'VERIFIED', 'FAILED', 'PROCESSED', 'IGNORED']);
});

test('ISS-017: the sweep recovers a virtual-account credit from its encrypted payload, amount intact', async () => {
  const credit = { collectionReference: 'col-9', providerReference: 'ps-9', accountReference: 'va-ref-1', accountNumber: '0123456789', amountMinor: 2_500_000n, currency: 'NGN' };
  const sealed = sealRecoveryPayload({ virtualAccountCredit: credit }, KEY);
  const rows = [row({ id: 'va', merchantReference: null, recoveryPayloadCiphertext: sealed })];
  const h = harness({ rows });
  assert.equal(await h.service.recoverStale(), 1);
  assert.deepEqual(h.calls.credit, [credit]);
  assert.equal(typeof h.calls.credit[0].amountMinor, 'bigint');
  assert.equal(rows[0].status, 'PROCESSED');
  assert.equal(rows[0].recoveryPayloadCiphertext, null);
});

test('ISS-017: a stuck event the sweep cannot rebuild is marked FAILED, never PROCESSED (it may be an old virtual-account credit)', async () => {
  const rows = [row({ id: 'legacy', merchantReference: null }), row({ id: 'unknown-ref', merchantReference: 'not-ours' })];
  const h = harness({ rows });
  assert.equal(await h.service.recoverStale(), 0);
  assert.deepEqual(rows.map((r) => [r.status, r.failureCode]), [['FAILED', 'WEBHOOK_RECOVERY_PAYLOAD_MISSING'], ['FAILED', 'WEBHOOK_RECOVERY_PAYLOAD_MISSING']]);
});

test('ISS-017: one handler failing marks that event FAILED and the sweep carries on with the rest', async () => {
  const rows = [row({ id: 'bad', merchantReference: 'fund:ref_1', receivedAt: ago(40 * MINUTE) }), row({ id: 'good', merchantReference: 'payout:ref_2', receivedAt: ago(30 * MINUTE) })];
  const h = harness({ rows, failOn: ['collection:fund:ref_1'] });
  assert.equal(await h.service.recoverStale(), 1);
  assert.deepEqual(rows.map((r) => [r.id, r.status, r.failureCode]), [['bad', 'FAILED', 'BOOM_collection:fund:ref_1'], ['good', 'PROCESSED', null]]);
});

test('ISS-017: the sweep is bounded by its limit, oldest first', async () => {
  const rows = [row({ id: 'new', receivedAt: ago(10 * MINUTE) }), row({ id: 'old', receivedAt: ago(50 * MINUTE) }), row({ id: 'mid', receivedAt: ago(30 * MINUTE) })];
  const h = harness({ rows });
  assert.equal(await h.service.recoverStale(2), 2);
  assert.deepEqual(rows.map((r) => [r.id, r.status]), [['new', 'PROCESSING'], ['old', 'PROCESSED'], ['mid', 'PROCESSED']]);
});

test('ISS-017: a sweep that loses the claim to a redelivery does not run the handler twice', async () => {
  const rows = [row({ id: 'race' })];
  const h = harness({ rows, verified: delivery() });
  const [swept, delivered] = await Promise.all([h.service.recoverStale(), receive(h.service)]);
  assert.deepEqual(h.calls.collection, ['fund:ref_1']);
  assert.equal(swept + (delivered.duplicate === false ? 1 : 0), 1);
});

// ---------------------------------------------------------------- what is stored

test('ISS-017: a virtual-account delivery keeps an encrypted copy, with no account number or email in the clear', async () => {
  const credit = { collectionReference: 'col-1', accountReference: 'va-ref-1', accountNumber: '0123456789', amountMinor: 1000n, currency: 'NGN' };
  const assignment = { status: 'ACTIVE', customerEmail: 'ada@twipay.example', accountNumber: '0123456789', accountName: 'Ada Obi', bankName: 'Wema' };
  const h = harness({ rows: [], verified: delivery({ merchantReference: undefined, virtualAccountCredit: credit, virtualAccountAssignment: assignment }) });
  await receive(h.service);
  const stored = h.calls.created[0];
  assert.match(stored.recoveryPayloadCiphertext, /^v1\./);
  for (const secret of ['0123456789', 'ada@twipay.example', 'Ada Obi']) {
    assert.ok(!stored.recoveryPayloadCiphertext.includes(secret), `${secret} must not appear in the stored copy`);
    assert.ok(!JSON.stringify(stored.normalizedPayload).includes(secret), `${secret} must not appear in normalizedPayload`);
  }
});

test('ISS-017: collection and payout deliveries keep no recovery payload at all', async () => {
  const h = harness({ rows: [], verified: delivery() });
  await receive(h.service);
  assert.equal(h.calls.createData.length, 1);
  assert.ok(!('recoveryPayloadCiphertext' in h.calls.createData[0]), 'the create call carries no recovery payload');
});

test('ISS-017: the recovery payload round-trips both virtual-account shapes and refuses a wrong key', () => {
  const credit = { collectionReference: 'c', amountMinor: 9_007_199_254_740_993n, currency: 'NGN' };
  const assignment = { status: 'FAILED' };
  const sealed = sealRecoveryPayload({ virtualAccountCredit: credit, virtualAccountAssignment: assignment }, KEY);
  assert.deepEqual(openRecoveryPayload(sealed, KEY), { virtualAccountCredit: credit, virtualAccountAssignment: assignment });
  assert.equal(sealRecoveryPayload({}, KEY), undefined);
  assert.throws(() => openRecoveryPayload(sealed, randomBytes(32).toString('base64')));
});

// ---------------------------------------------------------------- wiring

test('ISS-017: the worker sweep runs recoverStale and the migration is two additive nullable columns', () => {
  const worker = readFileSync(resolve(root, 'apps/worker/src/main.ts'), 'utf8');
  assert.match(worker, /webhooks\.recoverStale\(25\)/);
  assert.match(readFileSync(resolve(root, 'apps/api/src/worker-entry.ts'), 'utf8'), /WebhookService/);
  const sql = readFileSync(resolve(root, 'packages/database/prisma/migrations/0021_webhook_recovery/migration.sql'), 'utf8')
    .split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
  const statements = sql.split(';').map((s) => s.trim()).filter(Boolean);
  assert.deepEqual(statements, [
    'ALTER TABLE "webhook_events" ADD COLUMN "processingStartedAt" TIMESTAMPTZ(6)',
    'ALTER TABLE "webhook_events" ADD COLUMN "recoveryPayloadCiphertext" TEXT',
  ]);
  const schema = readFileSync(resolve(root, 'packages/database/prisma/schema.prisma'), 'utf8');
  assert.match(schema, /processingStartedAt\s+DateTime\?\s+@db\.Timestamptz\(6\)/);
  assert.match(schema, /recoveryPayloadCiphertext\s+String\?\s+@db\.Text/);
});
