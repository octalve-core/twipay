import { createHmac, randomBytes } from 'node:crypto';
import { expect, test, type APIRequestContext, type BrowserContext } from '@playwright/test';

const api = (process.env['API_URL'] ?? 'http://127.0.0.1:4000').replace(/\/$/, '');
const appOrigin = process.env['APP_URL'] ?? 'http://127.0.0.1:3000';

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomBytes(4).toString('hex')}@example.test`;
}

async function register(request: APIRequestContext, email: string, password: string) {
  const response = await request.post(`${api}/v1/auth/register`, {
    headers: { origin: appOrigin },
    data: { email, password, givenName: 'Release', familyName: 'Test' },
  });
  expect(response.status()).toBe(201);
  return response.json() as Promise<{ csrfToken: string; user: { id: string } }>;
}

async function csrf(request: APIRequestContext): Promise<string> {
  const response = await request.get(`${api}/v1/auth/csrf`);
  expect(response.ok()).toBeTruthy();
  return (await response.json() as { csrfToken: string }).csrfToken;
}

async function unsafe(request: APIRequestContext, method: 'POST' | 'PATCH' | 'DELETE', path: string, data: unknown, token: string, extra: Record<string, string> = {}) {
  return request.fetch(`${api}/v1${path}`, {
    method,
    headers: { origin: appOrigin, 'x-csrf-token': token, ...extra },
    data,
  });
}

async function mutate(request: APIRequestContext, path: string, data: unknown, token: string, extra: Record<string, string> = {}) {
  return unsafe(request, 'POST', path, data, token, extra);
}

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function decodeBase32(value: string): Buffer {
  let bits = '';
  for (const char of value.replace(/=+$/g, '').toUpperCase()) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error('INVALID_BASE32');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(Number.parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
function totp(secret: string, atMs = Date.now()): string {
  const step = BigInt(Math.floor(atMs / 30_000));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(step);
  const digest = createHmac('sha1', decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary = ((digest[offset]! & 0x7f) << 24) | ((digest[offset + 1]! & 0xff) << 16) | ((digest[offset + 2]! & 0xff) << 8) | (digest[offset + 3]! & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

async function sessionCookie(context: BrowserContext): Promise<string> {
  const cookie = (await context.cookies(api)).find((item) => item.name.includes('twipay_session'));
  if (!cookie) throw new Error('SESSION_COOKIE_MISSING');
  return cookie.value;
}

test('browser auth uses HttpOnly session, CSRF/origin protection, rotation and replay-safe MFA', async ({ browser }) => {
  const context = await browser.newContext();
  const request = context.request;
  const password = 'Release-test-password-42!';
  const email = uniqueEmail('mfa');
  const registered = await register(request, email, password);

  const cookies = await context.cookies(api);
  const session = cookies.find((item) => item.name.includes('twipay_session'));
  expect(session?.httpOnly).toBe(true);
  const page = await context.newPage();
  await page.goto(`${appOrigin}/login`);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);

  const noCsrf = await request.post(`${api}/v1/auth/mfa/enroll`, { headers: { origin: appOrigin }, data: { password } });
  expect(noCsrf.status()).toBe(401);
  const maliciousOrigin = await request.post(`${api}/v1/auth/mfa/enroll`, { headers: { origin: 'https://attacker.example', 'x-csrf-token': registered.csrfToken }, data: { password } });
  expect(maliciousOrigin.status()).toBe(403);

  const beforeEnrollment = await sessionCookie(context);
  let token = await csrf(request);
  const enrollmentResponse = await mutate(request, '/auth/mfa/enroll', { password }, token);
  expect(enrollmentResponse.ok()).toBeTruthy();
  const enrollment = (await enrollmentResponse.json() as { enrollment: { manualSecret: string; otpauthUri: string } }).enrollment;
  expect(enrollment.otpauthUri.startsWith('otpauth://totp/')).toBe(true);

  token = await csrf(request);
  const firstCode = totp(enrollment.manualSecret);
  const confirm = await mutate(request, '/auth/mfa/enroll/confirm', { code: firstCode }, token);
  expect(confirm.ok()).toBeTruthy();
  const recoveryCodes = (await confirm.json() as { recoveryCodes: string[] }).recoveryCodes;
  expect(recoveryCodes).toHaveLength(10);
  expect(await sessionCookie(context)).not.toBe(beforeEnrollment);
  const stolenPreMfa = await fetch(`${api}/v1/auth/me`, { headers: { cookie: `twipay_session=${beforeEnrollment}` } });
  expect(stolenPreMfa.status).toBe(401);

  token = await csrf(request);
  const replay = await mutate(request, '/auth/mfa/challenge', { code: firstCode }, token);
  expect(replay.status()).toBe(401);

  token = await csrf(request);
  const recovery = await mutate(request, '/auth/mfa/challenge', { code: recoveryCodes[0] }, token);
  expect(recovery.ok()).toBeTruthy();
  token = await csrf(request);
  const recoveryReplay = await mutate(request, '/auth/mfa/challenge', { code: recoveryCodes[0] }, token);
  expect(recoveryReplay.status()).toBe(401);

  await context.close();
});



test('account/profile/read-only finance and organizer lifecycle work through the real authenticated API', async ({ browser }) => {
  const owner = await browser.newContext();
  const staff = await browser.newContext();
  const password = 'Release-test-password-42!';
  const ownerEmail = uniqueEmail('lifecycle-owner');
  const staffEmail = uniqueEmail('lifecycle-staff');
  await register(owner.request, ownerEmail, password);
  await register(staff.request, staffEmail, password);

  let token = await csrf(owner.request);
  const profile = await unsafe(owner.request, 'PATCH', '/auth/me', { givenName: 'Qualified', familyName: 'Owner' }, token);
  expect(profile.ok()).toBeTruthy();

  const wallet = await owner.request.get(`${api}/v1/wallets`);
  expect(wallet.ok()).toBeTruthy();
  expect((await wallet.json() as { wallet: { currency: string; postedBalanceMinor: string } }).wallet)
    .toMatchObject({ currency: 'NGN', postedBalanceMinor: '0' });
  const transactions = await owner.request.get(`${api}/v1/transactions`);
  expect(transactions.ok()).toBeTruthy();
  expect((await transactions.json() as { transactions: unknown[] }).transactions).toEqual([]);
  const kyc = await owner.request.get(`${api}/v1/kyc/verifications`);
  expect(kyc.ok()).toBeTruthy();
  const serviceProducts = await owner.request.get(`${api}/v1/services/products`);
  expect(serviceProducts.ok()).toBeTruthy();

  token = await csrf(owner.request);
  const slug = `release-organizer-${Date.now()}`;
  const organizerResponse = await mutate(owner.request, '/events/organizers', { name: 'Release Organizer', slug }, token);
  expect(organizerResponse.ok()).toBeTruthy();
  const organizerId = (await organizerResponse.json() as { organizer: { id: string } }).organizer.id;

  token = await csrf(owner.request);
  const eventSlug = `release-event-${Date.now()}`;
  const eventResponse = await mutate(owner.request, '/events', {
    organizerId,
    slug: eventSlug,
    title: 'Release Qualification Event',
    startsAt: new Date(Date.now() + 86_400_000).toISOString(),
  }, token);
  expect(eventResponse.ok()).toBeTruthy();
  const eventId = (await eventResponse.json() as { event: { id: string } }).event.id;

  token = await csrf(owner.request);
  const ticketResponse = await mutate(owner.request, `/events/${eventId}/ticket-types`, { name: 'Standard', priceMinor: '1000', capacity: 2 }, token);
  expect(ticketResponse.ok()).toBeTruthy();

  token = await csrf(owner.request);
  const staffResponse = await mutate(owner.request, `/events/${eventId}/staff`, { email: staffEmail }, token);
  expect(staffResponse.ok()).toBeTruthy();
  const assignmentId = (await staffResponse.json() as { assignment: { id: string } }).assignment.id;

  token = await csrf(owner.request);
  const publish = await mutate(owner.request, `/events/${eventId}/publish`, {}, token);
  expect(publish.ok()).toBeTruthy();
  expect((await owner.request.get(`${api}/v1/events/${eventSlug}`)).ok()).toBeTruthy();
  expect((await owner.request.get(`${api}/v1/events/organizers/${organizerId}/settlement`)).ok()).toBeTruthy();

  token = await csrf(owner.request);
  const revoked = await unsafe(owner.request, 'DELETE', `/events/${eventId}/staff/${assignmentId}`, {}, token);
  expect(revoked.ok()).toBeTruthy();

  const adminBypass = await owner.request.get(`${api}/v1/operations/dashboard`);
  expect(adminBypass.status()).toBe(403);

  token = await csrf(owner.request);
  const logout = await mutate(owner.request, '/auth/logout', {}, token);
  expect(logout.ok()).toBeTruthy();
  expect((await owner.request.get(`${api}/v1/auth/me`)).status()).toBe(401);
  const login = await owner.request.post(`${api}/v1/auth/login`, {
    headers: { origin: appOrigin },
    data: { email: ownerEmail, password },
  });
  expect(login.ok()).toBeTruthy();
  expect((await owner.request.get(`${api}/v1/auth/me`)).ok()).toBeTruthy();

  await owner.close();
  await staff.close();
});

test('ownership/BOLA boundary rejects another customer organizer', async ({ browser }) => {
  const a = await browser.newContext();
  const b = await browser.newContext();
  const password = 'Release-test-password-42!';
  await register(a.request, uniqueEmail('owner-a'), password);
  await register(b.request, uniqueEmail('owner-b'), password);

  const tokenA = await csrf(a.request);
  const create = await mutate(a.request, '/events/organizers', { name: 'Owner A Events', slug: `owner-a-${Date.now()}` }, tokenA);
  expect(create.ok()).toBeTruthy();
  const organizerId = (await create.json() as { organizer: { id: string } }).organizer.id;

  const forbidden = await b.request.get(`${api}/v1/events/organizers/${organizerId}/events`);
  expect([403, 404]).toContain(forbidden.status());
  await a.close();
  await b.close();
});

test('web responses carry nonce CSP and no permissive script policy', async ({ page }) => {
  const response = await page.goto('/login');
  expect(response).not.toBeNull();
  const csp = response!.headers()['content-security-policy'] ?? '';
  expect(csp).toContain("'nonce-");
  expect(csp).toContain("'strict-dynamic'");
  expect(csp).not.toContain("script-src *");
  expect(csp).not.toContain("'unsafe-inline'");
});
