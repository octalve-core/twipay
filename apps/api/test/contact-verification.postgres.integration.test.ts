import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { decryptSensitiveString } from '@twipay/security';
import { ContactVerificationService } from '../src/modules/auth/application/contact-verification.service.js';
import { NotificationService } from '../src/modules/notifications/application/notification.service.js';

/**
 * Real PostgreSQL 18 tests. Independent PrismaPg pools, actual SQL row locks,
 * actual encrypted notification outbox. NO network email and NO production data.
 *
 * Requires the disposable phase1-3 Compose DB, NODE_ENV=test and the explicit
 * TWIPAY_PHASE31_REAL_DB=1 opt-in. A wrong URL must fail, not silently skip.
 */
const connectionString = process.env['DATABASE_URL'];
const explicitlyRequested = process.env['TWIPAY_PHASE31_REAL_DB'] === '1';
let permitted = false;
try {
  if (connectionString) {
    const url = new URL(connectionString);
    permitted = process.env['NODE_ENV'] === 'test'
      && url.protocol === 'postgresql:'
      && url.hostname === '127.0.0.1'
      && url.username === 'twipay_qualification'
      && url.pathname === '/twipay_qual_test'
      && url.port === (process.env['PHASE13_PG_PORT'] ?? '15435');
  }
} catch { permitted = false; }
if (explicitlyRequested && !permitted) {
  throw new Error('REFUSED: Phase 3.1 PostgreSQL tests require the known disposable Compose database');
}
const realDb = explicitlyRequested && permitted ? describe : describe.skip;

realDb('Phase 3.1: real PostgreSQL verification and row-lock contention', () => {
  const clients: PrismaClient[] = [];
  const services: ContactVerificationService[] = [];
  const suffix = randomUUID();
  const encryptionKey = process.env['DATA_ENCRYPTION_KEY'];

  beforeAll(async () => {
    if (!process.env['SESSION_HASH_PEPPER'] || process.env['SESSION_HASH_PEPPER']!.length < 32
      || !process.env['PII_FINGERPRINT_KEY'] || !encryptionKey) {
      throw new Error('Missing disposable test-only HMAC/encryption keys');
    }
    for (let i = 0; i < 3; i++) {
      const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: connectionString! }) });
      await prisma.$connect();
      clients.push(prisma);
      // Exercise the actual NotificationService and encrypted SQL outbox.
      // Only its *external provider* is replaced by a network-free fake.
      const notifications = new NotificationService(prisma as never, {
        get: () => ({
          code: 'QUALIFICATION_FAKE_EMAIL',
          send: async () => ({ status: 'ACCEPTED', providerCode: 'QUALIFICATION_FAKE_EMAIL' }),
        }),
      } as never);
      services.push(new ContactVerificationService(prisma as never, notifications));
    }
    const version = await clients[0]!.$queryRaw<Array<{ server_version_num: string }>>`SHOW server_version_num`;
    expect(version[0]!.server_version_num.startsWith('18')).toBe(true);
  });

  afterAll(async () => {
    await Promise.allSettled(clients.map((client) => client.$disconnect()));
  });

  async function newUser(name: string) {
    return clients[0]!.user.create({
      data: { email: `${name}-${randomUUID()}-${suffix}@example.test`, status: 'ACTIVE' },
    });
  }

  async function initial(user: Awaited<ReturnType<typeof newUser>>) {
    const id = await clients[0]!.$transaction((tx) => services[0]!.issueInitialWithTx(tx, user.id, user.email));
    return codeInNotification(id);
  }

  async function codeInNotification(id: string): Promise<string> {
    const notification = await clients[0]!.notification.findUniqueOrThrow({ where: { id } });
    expect(notification.destinationCiphertext).not.toContain('@example.test');
    const text = decryptSensitiveString(notification.bodyCiphertext, encryptionKey!);
    const code = text.match(/verification code is (\d{6})/i)?.[1];
    expect(code).toMatch(/^\d{6}$/);
    expect(notification.bodyCiphertext).not.toBe(text);
    return code!;
  }

  async function latestCode(userId: string): Promise<string> {
    const challenge = await clients[0]!.contactVerificationChallenge.findFirstOrThrow({
      where: { userId }, orderBy: { createdAt: 'desc' }, select: { id: true },
    });
    const message = await clients[0]!.notification.findUniqueOrThrow({
      where: { idempotencyKey: `contact-email:${challenge.id}` }, select: { id: true },
    });
    return codeInNotification(message.id);
  }

  /** Hold a genuine user row lock, then enqueue competing work on two other PG pools. */
  async function withLockedUser(userId: string, work: [() => Promise<unknown>, () => Promise<unknown>]) {
    let unlock!: () => void;
    let locked!: () => void;
    const lockAcquired = new Promise<void>((resolve) => { locked = resolve; });
    const untilUnlocked = new Promise<void>((resolve) => { unlock = resolve; });
    const blocker = clients[0]!.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      locked();
      await untilUnlocked;
    }, { timeout: 10000 });
    await lockAcquired;
    try {
      const requests = work.map((run) => run());
      // Ensure both operations are blocked against the database, not a JS mutex.
      const states = await Promise.race([
        Promise.allSettled(requests).then(() => 'completed'),
        new Promise<'waiting'>((resolve) => setTimeout(() => resolve('waiting'), 100)),
      ]);
      expect(states).toBe('waiting');
      unlock();
      await blocker;
      return Promise.allSettled(requests);
    } finally {
      unlock();
      await blocker;
    }
  }

  it('stores an HMAC challenge and encrypted outbox atomically; rollback leaves neither', async () => {
    const user = await newUser('atomic');
    await expect(clients[0]!.$transaction(async (tx) => {
      await services[0]!.issueInitialWithTx(tx, user.id, user.email);
      throw new Error('intentional rollback');
    })).rejects.toThrow('intentional rollback');
    expect(await clients[0]!.contactVerificationChallenge.count({ where: { userId: user.id } })).toBe(0);
    expect(await clients[0]!.notification.count({ where: { userId: user.id } })).toBe(0);
    const code = await initial(user);
    const row = await clients[0]!.contactVerificationChallenge.findFirstOrThrow({ where: { userId: user.id } });
    expect(row.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(row.codeHash).not.toBe(code);
    expect(await clients[0]!.notification.count({ where: { userId: user.id } })).toBe(1);
  });

  it('five bad attempts persist across transactions and correct code cannot bypass lockout', async () => {
    const user = await newUser('failed');
    const code = await initial(user);
    const wrong = code === '000000' ? '111111' : '000000';
    for (let attempt = 0; attempt < 5; attempt++) {
      await expect(services[attempt % 2]!.confirm(user.id, wrong)).rejects.toBeDefined();
    }
    const state = await clients[0]!.contactVerificationChallenge.findFirstOrThrow({ where: { userId: user.id } });
    expect(state.failedAttempts).toBe(5);
    expect(await clients[0]!.securityEvent.count({ where: { userId: user.id, type: 'CONTACT_CHALLENGE_FAILED' } })).toBe(5);
    await expect(services[0]!.confirm(user.id, code)).rejects.toBeDefined();
    expect((await clients[0]!.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt).toBeNull();
  });

  it('rejects expired codes and changed-email challenges', async () => {
    const user = await newUser('expiry');
    const code = await initial(user);
    await clients[0]!.contactVerificationChallenge.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(services[0]!.confirm(user.id, code)).rejects.toBeDefined();
    const changed = await newUser('changed');
    const oldCode = await initial(changed);
    await clients[0]!.user.update({ where: { id: changed.id }, data: { email: `updated-${randomUUID()}@example.test` } });
    await expect(services[0]!.confirm(changed.id, oldCode)).rejects.toBeDefined();
  });

  it('two independent connections cannot confirm the same challenge twice', async () => {
    const user = await newUser('confirm-race');
    const code = await initial(user);
    const results = await withLockedUser(user.id, [
      () => services[1]!.confirm(user.id, code),
      () => services[2]!.confirm(user.id, code),
    ]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((item) => item.status === 'rejected')).toHaveLength(1);
    expect(await clients[0]!.securityEvent.count({ where: { userId: user.id, type: 'CONTACT_EMAIL_VERIFIED' } })).toBe(1);
    expect((await clients[0]!.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt).toBeInstanceOf(Date);
    expect(await clients[0]!.contactVerificationChallenge.count({ where: { userId: user.id, consumedAt: null } })).toBe(0);
    await expect(services[0]!.confirm(user.id, code)).rejects.toBeDefined();
  });

  it('two independent connections cannot both resend during the same cooldown', async () => {
    const user = await newUser('resend-race');
    const oldCode = await initial(user);
    await clients[0]!.contactVerificationChallenge.updateMany({ where: { userId: user.id }, data: { createdAt: new Date(Date.now() - 61_000) } });
    const results = await withLockedUser(user.id, [
      () => services[1]!.resend(user.id),
      () => services[2]!.resend(user.id),
    ]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((item) => item.status === 'rejected')).toHaveLength(1);
    expect(await clients[0]!.contactVerificationChallenge.count({ where: { userId: user.id } })).toBe(2);
    expect(await clients[0]!.contactVerificationChallenge.count({ where: { userId: user.id, consumedAt: null } })).toBe(1);
    await expect(services[0]!.confirm(user.id, oldCode)).rejects.toBeDefined();
    await expect(services[0]!.confirm(user.id, await latestCode(user.id))).resolves.toBeUndefined();
  });

  it('ten challenges in rolling 24 hours block the eleventh', async () => {
    const user = await newUser('daily-limit');
    await initial(user);
    for (let i = 0; i < 9; i++) {
      // Backdate only this disposable fixture's latest challenge to avoid 10 min real-time waits.
      const row = await clients[0]!.contactVerificationChallenge.findFirstOrThrow({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
      await clients[0]!.contactVerificationChallenge.update({ where: { id: row.id }, data: { createdAt: new Date(Date.now() - 61_000) } });
      await services[0]!.resend(user.id);
    }
    const latest = await clients[0]!.contactVerificationChallenge.findFirstOrThrow({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
    await clients[0]!.contactVerificationChallenge.update({ where: { id: latest.id }, data: { createdAt: new Date(Date.now() - 61_000) } });
    await expect(services[0]!.resend(user.id)).rejects.toBeDefined();
    expect(await clients[0]!.contactVerificationChallenge.count({ where: { userId: user.id } })).toBe(10);
  });

  it('suspended accounts are denied confirmation and resend', async () => {
    const user = await newUser('suspended');
    const code = await initial(user);
    await clients[0]!.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } });
    await expect(services[0]!.confirm(user.id, code)).rejects.toBeDefined();
    await expect(services[0]!.resend(user.id)).rejects.toBeDefined();
    expect((await clients[0]!.user.findUniqueOrThrow({ where: { id: user.id } })).emailVerifiedAt).toBeNull();
  });
});
