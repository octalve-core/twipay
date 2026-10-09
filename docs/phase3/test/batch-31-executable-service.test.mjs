/**
 * Dependency-light execution of the ACTUAL Batch 3.1 service/guard implementations.
 * It transpiles the original TypeScript with the workspace TypeScript compiler and
 * injects in-memory Prisma/Nest seams. This is stronger than source matching but
 * explicitly NOT a PostgreSQL, Fastify, Redis, or email provider integration test.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const here = dirname(fileURLToPath(import.meta.url));
const PEPPER = 'batch-31-verification-testing-pepper-must-be-32-chars';
const USER_ID = '22222222-2222-4222-8222-222222222222';

class NestException extends Error {
  constructor(response, status) { super(response?.code ?? 'REQUEST_REJECTED'); this.response = response; this.status = status; }
}
class ForbiddenException extends NestException { constructor(response) { super(response, 403); } }
class UnauthorizedException extends NestException { constructor(response) { super(response, 401); } }
class HttpException extends NestException {}
const nest = {
  Injectable: () => target => target,
  SetMetadata: () => () => {},
  ForbiddenException, UnauthorizedException, HttpException,
  HttpStatus: { TOO_MANY_REQUESTS: 429 },
};
const originalPepper = process.env.SESSION_HASH_PEPPER;
const originalAppUrl = process.env.APP_URL;
process.env.SESSION_HASH_PEPPER = PEPPER;
process.env.APP_URL = 'https://twipay.test';
after(() => {
  if (originalPepper === undefined) delete process.env.SESSION_HASH_PEPPER; else   if (originalAppUrl === undefined) delete process.env.APP_URL; else process.env.APP_URL = originalAppUrl;
});

function transpileActual(relativePath, stubs, DateImpl = Date) {
  const filename = resolve(here, '../../../', relativePath);
  const input = readFileSync(filename, 'utf8');
  const result = ts.transpileModule(input, {
    fileName: filename,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      experimentalDecorators: true,
      emitDecoratorMetadata: false,
    },
  });
  const errors = (result.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, `${relativePath} failed TypeScript transpilation: ${errors.map(e => ts.flattenDiagnosticMessageText(e.messageText, ' ')).join('; ')}`);
  const module = { exports: {} };
  const execute = new Function('require', 'module', 'exports', 'Date', result.outputText);
  execute(id => {
    if (Object.hasOwn(stubs, id)) return stubs[id];
    if (id.startsWith('node:')) return require(id);
    throw new Error(`Unexpected runtime dependency ${id} while executing ${relativePath}`);
  }, module, module.exports, DateImpl);
  return module.exports;
}
const contactPermission = transpileActual('apps/api/src/modules/auth/application/contact-permissions.ts', {});
function testContext() {
  let now = Date.parse('2026-10-09T07:00:00Z');
  class TestDate extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  }
  const { ContactVerificationService } = transpileActual('apps/api/src/modules/auth/application/contact-verification.service.ts', {
    '@nestjs/common': nest,
    '../../../platform/database/prisma.service.js': {},
    '../../notifications/application/notification.service.js': {},
  }, TestDate);
  let queue = Promise.resolve();
  let serial = 0;
  const user = { id: USER_ID, email: 'example@twipay.test', emailVerifiedAt: null, status: 'ACTIVE' };
  const challenges = [];
  const outbox = [];
  const securityEvents = [];
  const tx = {
    $queryRaw: async () => [{ id: USER_ID }],
    user: {
      findUniqueOrThrow: async () => ({ ...user }),
      update: async ({ data }) => { user.emailVerifiedAt = data.emailVerifiedAt; return { ...user }; },
    },
    contactVerificationChallenge: {
      create: async ({ data }) => {
        const row = { ...data, id: `challenge-${++serial}`, createdAt: new Date(now), consumedAt: null, failedAttempts: 0 };
        challenges.push(row); return row;
      },
      findFirst: async () => challenges.at(-1) ?? null,
      count: async ({ where }) => challenges.filter(c => c.createdAt >= where.createdAt.gte).length,
      updateMany: async ({ where, data }) => {
        const rows = challenges.filter(c => c.userId === where.userId && c.consumedAt === null);
        rows.forEach(c => { c.consumedAt = data.consumedAt; });
        return { count: rows.length };
      },
      update: async ({ where, data }) => {
        const row = challenges.find(c => c.id === where.id);
        if (data.failedAttempts) row.failedAttempts += data.failedAttempts.increment;
        if (data.consumedAt) row.consumedAt = data.consumedAt;
        return row;
      },
    },
    securityEvent: { create: async ({ data }) => { securityEvents.push(data); return data; } },
  };
  const prisma = {
    $transaction: async callback => {
      // Simulates row serialization only. Actual multi-process PG locks must be tested separately.
      const predecessor = queue;
      let release;
      queue = new Promise(resolve => { release = resolve; });
      await predecessor;
      try { return await callback(tx); } finally { release(); }
    },
    notification: { findUnique: async () => ({ status: 'PENDING' }) },
  };
  const notifications = {
    enqueueWithTx: async (_tx, input) => {
      const row = { ...input, id: `message-${++serial}` }; outbox.push(row); return row;
    },
    deliver: async () => {},
  };
  const service = new ContactVerificationService(prisma, notifications);
  async function issue() { await service.issueInitialWithTx(tx, user.id, user.email); return lastCode(); }
  function lastCode() { return outbox.at(-1).text.match(/code is (\d{6})/i)[1]; }
  function advance(milliseconds) { now += milliseconds; }
  return { service, prisma, notifications, user, challenges, outbox, securityEvents, issue, lastCode, advance };
}
const expectCode = async (fn, code) => assert.rejects(fn, e => e?.response?.code === code);

test('real contact service stores only a digest and queues code for encrypted notification boundary', async () => {
  const t = testContext(); const code = await t.issue();
  assert.match(code, /^\d{6}$/);
  assert.match(t.challenges[0].codeHash, /^[a-f\d]{64}$/);
  assert.notEqual(t.challenges[0].codeHash, code);
  assert.equal(t.user.emailVerifiedAt, null);
  assert.equal(t.outbox.length, 1);
});
test('real service consumes code once and denies replay', async () => {
  const t = testContext(); const code = await t.issue();
  await t.service.confirm(USER_ID, code);
  assert.ok(t.user.emailVerifiedAt instanceof Date);
  await expectCode(() => t.service.confirm(USER_ID, code), 'CONTACT_ALREADY_VERIFIED');
  assert.ok(t.challenges[0].consumedAt);
});
test('five incorrect attempts persist then disable the challenge', async () => {
  const t = testContext(); const code = await t.issue(); const wrong = code === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) await expectCode(() => t.service.confirm(USER_ID, wrong), 'CONTACT_CODE_INVALID');
  assert.equal(t.challenges[0].failedAttempts, 5);
  await expectCode(() => t.service.confirm(USER_ID, code), 'CONTACT_CODE_INVALID');
  assert.equal(t.user.emailVerifiedAt, null);
});
test('expired or email-mismatched challenges cannot verify account', async () => {
  const expired = testContext(); const code = await expired.issue(); expired.advance(10 * 60_000 + 1);
  await expectCode(() => expired.service.confirm(USER_ID, code), 'CONTACT_CODE_INVALID');
  const mismatch = testContext(); const oldCode = await mismatch.issue(); mismatch.user.email = 'new@twipay.test';
  await expectCode(() => mismatch.service.confirm(USER_ID, oldCode), 'CONTACT_CODE_INVALID');
});
test('resend cooldown, invalidation, and current-code verification', async () => {
  const t = testContext(); const oldCode = await t.issue();
  await expectCode(() => t.service.resend(USER_ID), 'CONTACT_RESEND_TOO_SOON');
  t.advance(60_001); await t.service.resend(USER_ID);
  await expectCode(() => t.service.confirm(USER_ID, oldCode), 'CONTACT_CODE_INVALID');
  await t.service.confirm(USER_ID, t.lastCode());
  assert.ok(t.user.emailVerifiedAt);
});
test('daily issuance cap is enforced by the real service', async () => {
  const t = testContext(); await t.issue();
  for (let i = 0; i < 9; i++) { t.advance(60_001); await t.service.resend(USER_ID); }
  t.advance(60_001);
  await expectCode(() => t.service.resend(USER_ID), 'CONTACT_RESEND_LIMIT');
  assert.equal(t.challenges.length, 10);
});
test('concurrent confirmations and resends serialize in fixture; require separate PostgreSQL proof', async () => {
  const a = testContext(); const code = await a.issue();
  const results = await Promise.allSettled([a.service.confirm(USER_ID, code), a.service.confirm(USER_ID, code)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const b = testContext(); await b.issue(); b.advance(60_001);
  const resends = await Promise.allSettled([b.service.resend(USER_ID), b.service.resend(USER_ID)]);
  assert.equal(resends.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(b.challenges.length, 2);
});
test('real service fails closed when notification dispatch is unavailable', async () => {
  const t = testContext(); await t.issue();
  t.notifications.deliver = async () => { throw new Error('provider unavailable'); };
  assert.equal(await t.service.dispatch(t.outbox[0].id), 'PENDING');
});
test('verified phone requires a collected number', () => {
  assert.equal(contactPermission.contactVerified({ emailVerifiedAt: null, phoneE164: null, phoneVerifiedAt: new Date() }), false);
  assert.equal(contactPermission.contactVerified({ emailVerifiedAt: null, phoneE164: '+2348012345678', phoneVerifiedAt: new Date() }), true);
});
function guardFixture({ verified = false, mfa = false, recent = false, permitted = false, cookie = true } = {}) {
  const { SessionAuthGuard } = transpileActual('apps/api/src/modules/auth/presentation/session-auth.guard.ts', {
    '@nestjs/common': nest,
    '@nestjs/core': {},
    '@twipay/security': {
      SESSION_COOKIE_LOCAL: 'twipay_session', SESSION_COOKIE_PRODUCTION: '__Host-twipay_session',
      isRecentMfaAssurance: value => Boolean(value && recent),
    },
    '../application/contact-permissions.js': contactPermission,
    '../application/session.service.js': {},
  });
  const req = { cookies: cookie ? { twipay_session: 'test-token' } : {} };
  const sessions = {
    resolve: async () => ({ id: 'session-id', userId: USER_ID, mfaSatisfiedAt: recent ? new Date() : null,
      user: { emailVerifiedAt: verified ? new Date() : null, phoneE164: null, phoneVerifiedAt: null,
        mfaCredentials: mfa ? [{ id: 'credential' }] : [], roleAssignments: [] } }),
  };
  const reflector = { getAllAndOverride: () => permitted };
  const guard = new SessionAuthGuard(sessions, reflector);
  const ctx = { switchToHttp: () => ({ getRequest: () => req }), getHandler: () => null, getClass: () => null };
  return { guard, ctx, req };
}
test('actual session guard denies unverified ordinary API requests', async () => {
  const g = guardFixture(); await expectCode(() => g.guard.canActivate(g.ctx), 'CONTACT_VERIFICATION_REQUIRED');
});
test('actual session guard enforces login MFA independently', async () => {
  const g = guardFixture({ verified: true, mfa: true });
  await expectCode(() => g.guard.canActivate(g.ctx), 'MFA_CHALLENGE_REQUIRED');
});
test('actual session guard allows verified + MFA-satisfied requests', async () => {
  const g = guardFixture({ verified: true, mfa: true, recent: true });
  assert.equal(await g.guard.canActivate(g.ctx), true);
  assert.equal(g.req.twipayPrincipal.userId, USER_ID);
});
test('restricted recovery endpoints allow contact verification but still require a session', async () => {
  const recovery = guardFixture({ permitted: true });
  assert.equal(await recovery.guard.canActivate(recovery.ctx), true);
  const missingSession = guardFixture({ permitted: true, cookie: false });
  await expectCode(() => missingSession.guard.canActivate(missingSession.ctx), 'AUTHENTICATION_REQUIRED');
});
function csrfFixture(overrides = {}) {
  const { RequestSecurityGuard } = transpileActual('apps/api/src/modules/auth/presentation/request-security.guard.ts', {
    '@nestjs/common': nest,
    '@twipay/security': {
      CSRF_COOKIE_LOCAL: 'twipay_csrf', CSRF_COOKIE_PRODUCTION: '__Host-twipay_csrf',
      SESSION_COOKIE_LOCAL: 'twipay_session', SESSION_COOKIE_PRODUCTION: '__Host-twipay_session',
      isAllowedBrowserOrigin: (origin, allowed) => Boolean(origin && allowed.includes(origin)),
      isUnsafeMethod: method => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method),
    },
    '../application/session.service.js': {},
  });
  const counts = { resolved: 0, verified: 0 };
  const sessions = {
    resolve: async () => { counts.resolved++; return { id: 'valid-session' }; },
    verifyCsrf: async (_id, token) => { counts.verified++; if (token !== 'correct-csrf') throw new UnauthorizedException({code:'CSRF_INVALID'}); },
  };
  const req = {
    method: 'POST', url: '/v1/auth/contact/email/confirm',
    headers: { origin: 'https://twipay.test', 'x-csrf-token': 'correct-csrf' },
    cookies: { twipay_session: 'valid-session-token', twipay_csrf: 'correct-csrf' },
    ...overrides,
  };
  const guard = new RequestSecurityGuard(sessions);
  const ctx = { switchToHttp: () => ({ getRequest: () => req }) };
  return { guard, ctx, counts };
}
test('actual CSRF guard checks cookie, header and session binding on verification mutation', async () => {
  const t = csrfFixture(); assert.equal(await t.guard.canActivate(t.ctx), true);
  assert.equal(t.counts.resolved, 1); assert.equal(t.counts.verified, 1);
});
test('actual CSRF guard rejects mismatched header or missing cookie on verification mutation', async () => {
  for (const cookies of [{ twipay_session: 'valid-session-token' }, { twipay_session: 'valid-session-token', twipay_csrf: 'bad-token' }]) {
    const t = csrfFixture({ cookies });
    await expectCode(() => t.guard.canActivate(t.ctx), 'CSRF_REQUIRED');
    assert.equal(t.counts.verified, 0);
  }
});
test('actual CSRF guard rejects unapproved Origin even with valid CSRF', async () => {
  const t = csrfFixture({ headers: { origin: 'https://attacker.test', 'x-csrf-token': 'correct-csrf' } });
  await expectCode(() => t.guard.canActivate(t.ctx), 'ORIGIN_NOT_ALLOWED');
  assert.equal(t.counts.resolved, 0);
});
test('actual CSRF guard exempts browser login but never contact confirmation', async () => {
  const t = csrfFixture({ url: '/v1/auth/login', cookies: {}, headers: { origin: 'https://twipay.test' } });
  assert.equal(await t.guard.canActivate(t.ctx), true);
  const restricted = csrfFixture({ cookies: {}, headers: { origin: 'https://twipay.test' } });
  await expectCode(() => restricted.guard.canActivate(restricted.ctx), 'CSRF_REQUIRED');
});
// no API/provider calls, no credentials, no financial state mutation
