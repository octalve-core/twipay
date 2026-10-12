import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { normalizeEmail, validatePasswordPolicy } from '@twipay/security';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { PasswordHasher } from '../infrastructure/password-hasher.js';
import { NotificationService } from '../../notifications/application/notification.service.js';

const RESET_TTL_MS = 10 * 60_000;
const RESET_COOLDOWN_MS = 60_000;
const DAILY_RESET_LIMIT = 5;
const MAX_GUESSES = 5;

function digest(userId: string, email: string, code: string): string {
  const pepper = process.env['SESSION_HASH_PEPPER'];
  if (!pepper || pepper.length < 32) throw new Error('SESSION_HASH_PEPPER must be configured');
  return createHmac('sha256', pepper).update('twipay:password-reset:v1\0').update(userId).update('\0').update(email).update('\0').update(code).digest('hex');
}
function digestMatches(expected: string, actual: string): boolean {
  const left = Buffer.from(expected, 'hex');
  const right = Buffer.from(actual, 'hex');
  return left.length === 32 && right.length === 32 && timingSafeEqual(left, right);
}
function requirePasswordPolicy(value: string): void {
  const problems = validatePasswordPolicy(value);
  if (problems.length) throw new ForbiddenException({ code: problems[0] });
}

@Injectable()
export class PasswordSecurityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordHasher,
    private readonly notifications: NotificationService,
  ) {}

  /** Same public response for unknown, unverified, disabled, cooling-down and eligible accounts. */
  async requestReset(rawEmail: string): Promise<{ ok: true }> {
    const email = normalizeEmail(rawEmail);
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) return { ok: true };
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${user.id}::uuid FOR UPDATE`;
      const account = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true, status: true, emailVerifiedAt: true, passwordCredential: { select: { userId: true } } } });
      if (account.status !== 'ACTIVE' || !account.emailVerifiedAt || !account.passwordCredential || account.email !== email) return null;
      const now = new Date();
      const latest = await tx.passwordResetChallenge.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
      if (latest && now.getTime() - latest.createdAt.getTime() < RESET_COOLDOWN_MS) return null;
      const total = await tx.passwordResetChallenge.count({ where: { userId: user.id, createdAt: { gte: new Date(now.getTime() - 86_400_000) } } });
      if (total >= DAILY_RESET_LIMIT) return null;
      await tx.passwordResetChallenge.updateMany({ where: { userId: user.id, consumedAt: null }, data: { consumedAt: now } });
      const code = randomInt(0, 100_000_000).toString().padStart(8, '0');
      const challenge = await tx.passwordResetChallenge.create({
        data: { userId: user.id, email, codeHash: digest(user.id, email, code), expiresAt: new Date(now.getTime() + RESET_TTL_MS) },
        select: { id: true },
      });
      const notice = await this.notifications.enqueueWithTx(tx, {
        userId: user.id, channel: 'EMAIL', destination: email, templateCode: 'PASSWORD_RECOVERY',
        subject: 'Reset your TwiPay password',
        text: `You requested a TwiPay password reset. Your code is ${code}. It expires in 10 minutes. If you did not request it, ignore this email. Never share this code.`,
        idempotencyKey: `password-reset:${challenge.id}`,
      });
      await tx.securityEvent.create({ data: { userId: user.id, type: 'PASSWORD_RESET_REQUESTED' } });
      return notice.id;
    });
    // Dispatch occurs through the existing durable outbox worker. Never await an
    // email provider on this public path: provider latency would leak account existence.
    return { ok: true };
  }

  async completeReset(rawEmail: string, code: string, newPassword: string): Promise<{ ok: true }> {
    requirePasswordPolicy(newPassword);
    const email = normalizeEmail(rawEmail);
    // Avoid sending any session cookies or authenticating the caller as a side effect.
    const newHash = await this.passwords.hash(newPassword);
    const user = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!user) throw new ForbiddenException({ code: 'RESET_CODE_INVALID' });
    const outcome = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${user.id}::uuid FOR UPDATE`;
      const account = await tx.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true, emailVerifiedAt: true, status: true } });
      if (account.status !== 'ACTIVE' || !account.emailVerifiedAt || account.email !== email) return false;
      const now = new Date();
      const current = await tx.passwordResetChallenge.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
      if (!current || current.consumedAt || current.expiresAt <= now || current.email !== email || current.failedAttempts >= MAX_GUESSES) return false;
      if (!digestMatches(current.codeHash, digest(user.id, email, code))) {
        // Return false rather than throw inside tx: a throw would roll back failed-attempt accounting.
        await tx.passwordResetChallenge.update({ where: { id: current.id }, data: { failedAttempts: { increment: 1 } } });
        return false;
      }
      const credential = await tx.passwordCredential.findUnique({ where: { userId: user.id }, select: { passwordHash: true } });
      if (!credential || await this.passwords.verify(credential.passwordHash, newPassword)) return false;
      await tx.passwordCredential.update({ where: { userId: user.id }, data: { passwordHash: newHash, changedAt: now } });
      await tx.passwordResetChallenge.updateMany({ where: { userId: user.id, consumedAt: null }, data: { consumedAt: now } });
      await tx.session.updateMany({ where: { userId: user.id, status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt: now, revokeReason: 'PASSWORD_RESET' } });
      await tx.securityEvent.create({ data: { userId: user.id, type: 'PASSWORD_RESET_COMPLETED' } });
      await this.notifications.enqueueWithTx(tx, {
        userId: user.id, channel: 'EMAIL', destination: email, templateCode: 'PASSWORD_RESET_SECURITY_ALERT',
        subject: 'Your TwiPay password was reset',
        text: 'Your TwiPay password has been reset. All previous sessions have been signed out. If this was not you, please contact TwiPay support immediately.',
        idempotencyKey: `password-reset-alert:${current.id}`,
      });
      return true;
    });
    if (!outcome) throw new ForbiddenException({ code: 'RESET_CODE_INVALID' });
    return { ok: true };
  }

  /** Password change requires a contact-verified, MFA-cleared session (enforced by SessionAuthGuard). */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ ok: true }> {
    requirePasswordPolicy(newPassword);
    const newHash = await this.passwords.hash(newPassword);
    const changed = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      const credential = await tx.passwordCredential.findUnique({ where: { userId }, select: { passwordHash: true } });
      if (!credential || !await this.passwords.verify(credential.passwordHash, currentPassword)) return false;
      if (await this.passwords.verify(credential.passwordHash, newPassword)) return false;
      const now = new Date();
      await tx.passwordCredential.update({ where: { userId }, data: { passwordHash: newHash, changedAt: now } });
      await tx.passwordResetChallenge.updateMany({ where: { userId, consumedAt: null }, data: { consumedAt: now } });
      await tx.session.updateMany({ where: { userId, status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt: now, revokeReason: 'PASSWORD_CHANGED' } });
      await tx.securityEvent.create({ data: { userId, type: 'PASSWORD_CHANGED' } });
      const account = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
      await this.notifications.enqueueWithTx(tx, {
        userId, channel: 'EMAIL', destination: account.email, templateCode: 'PASSWORD_CHANGED_SECURITY_ALERT',
        subject: 'Your TwiPay password was changed',
        text: 'Your TwiPay password has been changed. All previous sessions have been signed out. If this was not you, please contact TwiPay support immediately.',
        idempotencyKey: `password-change-alert:${userId}:${now.getTime()}`,
      });
      return true;
    });
    if (!changed) throw new ForbiddenException({ code: 'PASSWORD_CHANGE_DENIED' });
    return { ok: true };
  }

  async listSessions(userId: string, currentSessionId: string) {
    const rows = await this.prisma.session.findMany({
      where: { userId, status: 'ACTIVE', expiresAt: { gt: new Date() }, lastSeenAt: { gt: new Date(Date.now() - 86_400_000) } },
      orderBy: { createdAt: 'desc' }, take: 30,
      select: { id: true, userAgent: true, createdAt: true, lastSeenAt: true, expiresAt: true },
    });
    return rows.map((row) => ({ ...row, current: row.id === currentSessionId }));
  }

  async revokeOtherSessions(userId: string, currentSessionId: string, currentPassword: string) {
    const count = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      const credential = await tx.passwordCredential.findUnique({ where: { userId }, select: { passwordHash: true } });
      if (!credential || !await this.passwords.verify(credential.passwordHash, currentPassword)) return null;
      const now = new Date();
      const revoked = await tx.session.updateMany({ where: { userId, status: 'ACTIVE', id: { not: currentSessionId } }, data: { status: 'REVOKED', revokedAt: now, revokeReason: 'USER_REVOKED_OTHER_SESSIONS' } });
      await tx.securityEvent.create({ data: { userId, type: 'SESSION_REVOKED', metadata: { reason: 'USER_REVOKED_OTHER_SESSIONS', count: revoked.count } } });
      return revoked.count;
    });
    if (count === null) throw new ForbiddenException({ code: 'INVALID_CREDENTIALS' });
    return { revoked: count };
  }
}
