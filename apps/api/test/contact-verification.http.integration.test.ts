import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { decryptSensitiveString } from '@twipay/security';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Real compiled NestJS/Fastify on loopback, real PostgreSQL, real cookies/CSRF.
 * No network provider credentials: verification codes are read only from the
 * local encrypted outbox and never logged. NOT an inbox-delivery test.
 */
const databaseUrl = process.env['DATABASE_URL'];
const optIn = process.env['TWIPAY_PHASE31_REAL_DB'] === '1';
let disposable = false;
try {
  const url = new URL(databaseUrl!);
  disposable = process.env['NODE_ENV'] === 'test'
    && url.protocol === 'postgresql:'
    && url.hostname === '127.0.0.1'
    && url.username === 'twipay_qualification'
    && url.pathname === '/twipay_qual_test'
    && url.port === (process.env['PHASE13_PG_PORT'] ?? '15435');
} catch { disposable = false; }
if (optIn && !disposable) throw new Error('REFUSED: actual HTTP qualification requires disposable loopback PG database');
const run = optIn && disposable ? describe : describe.skip;

run('Phase 3.1: actual HTTP verification/session/CSRF/MFA journey', () => {
  const port = 15401;
  const baseUrl = `http://127.0.0.1:${port}`;
  const origin = process.env['APP_URL'] ?? 'http://127.0.0.1:3000';
  let processApi: ChildProcess;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl! }) });
    await prisma.$connect();
    const main = resolve(process.cwd(), 'dist/main.js');
    processApi = spawn(process.execPath, [main], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'test', API_BIND_HOST: '127.0.0.1', API_PORT: String(port),
        OPENAPI_DOCS_ENABLED: 'false',
        RESEND_API_KEY: '', RESEND_FROM: '', // never send a live provider message
        WALLET_COLLECTIONS_SANDBOX_ENABLED: 'false',
        BANK_TRANSFERS_SANDBOX_ENABLED: 'false',
        VIRTUAL_ACCOUNTS_SANDBOX_ENABLED: 'false',
        BILL_PURCHASES_SANDBOX_ENABLED: 'false',
        EVENT_CHECKOUT_SANDBOX_ENABLED: 'false',
        EVENT_TICKET_QR_SANDBOX_ENABLED: 'false',
        HIGH_RISK_FEATURES_RELEASE_QUALIFIED: 'false',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    processApi.stdout?.resume();
    processApi.stderr?.resume();
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      if (processApi.exitCode !== null) break;
      try {
        const response = await fetch(`${baseUrl}/v1/health/live`, { signal: AbortSignal.timeout(1000) });
        if (response.ok) { ready = true; break; }
      } catch { /* still starting */ }
      await delay(125);
    }
    if (!ready) throw new Error(`Real API process did not become healthy (exit=${processApi.exitCode}). Output suppressed to avoid leaking secrets`);
  }, 25000);

  afterAll(async () => {
    if (processApi && processApi.exitCode === null) {
      processApi.kill('SIGTERM');
      await Promise.race([new Promise<void>((done) => processApi.once('exit', () => done())), delay(4000)]);
      if (processApi.exitCode === null) processApi.kill('SIGKILL');
    }
    await prisma?.$disconnect();
  });

  function cookies(response: Response): { header: string; csrf: string } {
    const entries = response.headers.getSetCookie().map((value) => value.split(';')[0]!);
    const header = entries.filter((value) => value.startsWith('twipay_session=') || value.startsWith('twipay_csrf=')).join('; ');
    const csrf = entries.find((value) => value.startsWith('twipay_csrf='))?.slice('twipay_csrf='.length) ?? '';
    expect(header).toContain('twipay_session=');
    expect(csrf).not.toBe('');
    return { header, csrf };
  }

  async function request(path: string, method: string, cookieHeader = '', csrf = '', body?: unknown, browserOrigin = origin) {
    return fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        origin: browserOrigin,
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
        ...(csrf ? { 'x-csrf-token': csrf } : {}),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }

  it('restricts new accounts, enforces live CSRF and origin, rotates verified sessions and requires MFA', async () => {
    const email = `phase31-http-${randomUUID()}@example.test`;
    const signup = await request('/v1/auth/register', 'POST', '', '', {
      givenName: 'Runtime', familyName: 'Qualification', email, password: 'UniquePassphrase#9-Qualification',
    });
    expect(signup.status).toBe(201);
    const first = cookies(signup);
    const registered = await signup.json() as { csrfToken?: string; user?: { id: string }; verificationDelivery?: string };
    expect(registered.user?.id).toBeTruthy();
    expect(registered.csrfToken).toBe(first.csrf);
    expect(registered).not.toHaveProperty('code');

    const identity = await request('/v1/auth/me', 'GET', first.header);
    expect(identity.status).toBe(200);
    expect((await identity.json() as { user: { contactVerified: boolean } }).user.contactVerified).toBe(false);
    expect((await request('/v1/notifications', 'GET', first.header)).status).toBe(403);
    expect((await request('/v1/notifications', 'GET')).status).toBe(401);
    expect((await request('/v1/auth/contact/email/resend', 'POST', first.header, first.csrf)).status).toBe(429);
    expect((await request('/v1/auth/contact/email/confirm', 'POST', first.header, '', { code: '000000' })).status).toBe(401);
    // Six contact mutations per minute is the existing server-level risk limit;
    // keep this live-HTTP scenario within it. Cookie/header mismatch is also
    // exercised by the separate RequestSecurityGuard behavioral suite.
    expect((await request('/v1/auth/contact/email/confirm', 'POST', first.header, first.csrf, { code: '000000' }, 'https://attacker.example')).status).toBe(403);

    const message = await prisma.notification.findFirstOrThrow({
      where: { userId: registered.user!.id, templateCode: 'CONTACT_EMAIL_VERIFICATION' }, orderBy: { createdAt: 'desc' },
    });
    const text = decryptSensitiveString(message.bodyCiphertext, process.env['DATA_ENCRYPTION_KEY']!);
    const code = text.match(/verification code is (\d{6})/i)?.[1];
    expect(code).toMatch(/^\d{6}$/);
    const incorrect = `${(Number(code![0]) + 1) % 10}${code!.slice(1)}`;
    expect((await request('/v1/auth/contact/email/confirm', 'POST', first.header, first.csrf, { code: incorrect })).status).toBe(403);
    const row = await prisma.contactVerificationChallenge.findFirstOrThrow({ where: { userId: registered.user!.id } });
    expect(row.failedAttempts).toBe(1);

    const verified = await request('/v1/auth/contact/email/confirm', 'POST', first.header, first.csrf, { code });
    expect(verified.status).toBe(201);
    const second = cookies(verified);
    expect(second.header).not.toBe(first.header);
    expect((await request('/v1/auth/me', 'GET', first.header)).status).toBe(401);
    const confirmed = await request('/v1/auth/me', 'GET', second.header);
    expect(confirmed.status).toBe(200);
    expect((await confirmed.json() as { user: { contactVerified: boolean } }).user.contactVerified).toBe(true);
    expect((await request('/v1/notifications', 'GET', second.header)).status).toBe(200);
    expect((await request('/v1/auth/contact/email/confirm', 'POST', second.header, second.csrf, { code })).status).toBe(403);
    expect(await prisma.securityEvent.count({ where: { userId: registered.user!.id, type: 'CONTACT_EMAIL_VERIFIED' } })).toBe(1);

    // Existing users with enabled MFA must not read protected customer resources
    // using a merely contact-verified, pre-MFA session.
    const credential = await prisma.mfaCredential.create({ data: { userId: registered.user!.id, secretCiphertext: 'qualification-only-fake-secret' } });
    await prisma.mfaCredential.update({ where: { id: credential.id }, data: { status: 'ACTIVE', enabledAt: new Date() } });
    expect((await request('/v1/notifications', 'GET', second.header)).status).toBe(403);
    expect((await request('/v1/auth/logout', 'POST', second.header, second.csrf)).status).toBe(201);
    expect((await request('/v1/auth/me', 'GET', second.header)).status).toBe(401);
  }, 25000);
});
