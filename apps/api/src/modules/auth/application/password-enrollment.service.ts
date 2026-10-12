import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { validatePasswordPolicy } from '@twipay/security';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { PasswordHasher } from '../infrastructure/password-hasher.js';
import { NotificationService } from '../../notifications/application/notification.service.js';
import {
  CHALLENGE_COOLDOWN_MS, CHALLENGE_DAILY_LIMIT, CHALLENGE_MAX_ATTEMPTS, CHALLENGE_TTL_MS,
  challengeDigest, generateEightDigitCode, matchesChallenge,
} from './credential-challenge.js';

/** Bootstrap a password ONLY after a verified-email challenge bound to an authenticated session.
 * Google sign-in alone is not treated as a password or as authorization to change an existing password.
 * SessionAuthGuard enforces contact verification and existing MFA before these endpoints.
 */
@Injectable()
export class PasswordEnrollmentService {
  constructor(private readonly prisma: PrismaService, private readonly passwords: PasswordHasher, private readonly notifications: NotificationService) {}

  async status(userId: string) {
    return { hasPassword: Boolean(await this.prisma.passwordCredential.findUnique({ where: { userId }, select: { userId: true } })) };
  }

  async request(userId: string, sessionId: string) {
    const ok = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id"=${userId}::uuid FOR UPDATE`;
      const account = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { status: true, email: true, emailVerifiedAt: true } });
      if (account.status !== 'ACTIVE' || !account.emailVerifiedAt) return false;
      if (await tx.passwordCredential.findUnique({ where: { userId }, select: { userId: true } })) return false;
      if (!await tx.oAuthIdentity.findFirst({ where: { userId, provider: 'GOOGLE' }, select: { id: true } })) return false;
      const now = new Date();
      const latest = await tx.passwordEnrollmentChallenge.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
      if (latest && now.getTime() - latest.createdAt.getTime() < CHALLENGE_COOLDOWN_MS) return false;
      const count = await tx.passwordEnrollmentChallenge.count({ where: { userId, createdAt: { gte: new Date(now.getTime() - 86_400_000) } } });
      if (count >= CHALLENGE_DAILY_LIMIT) return false;
      await tx.passwordEnrollmentChallenge.updateMany({ where: { userId, consumedAt: null }, data: { consumedAt: now } });
      const code = generateEightDigitCode();
      const challenge = await tx.passwordEnrollmentChallenge.create({ data: { userId, sessionId, email: account.email, codeHash: challengeDigest('password-enroll', userId, sessionId, account.email, code), expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS) } });
      await this.notifications.enqueueWithTx(tx, { userId, channel: 'EMAIL', destination: account.email, templateCode: 'PASSWORD_ENROLLMENT', subject: 'Set up your TwiPay password', text: `Your TwiPay password setup code is ${code}. It expires in 10 minutes. Never share this code.`, idempotencyKey: `password-enroll:${challenge.id}` });
      await tx.securityEvent.create({ data: { userId, type: 'PASSWORD_ENROLLMENT_REQUESTED' } });
      return true;
    });
    if (!ok) throw new ForbiddenException({ code: 'PASSWORD_SETUP_UNAVAILABLE' });
    return { deliveryStatus: 'PENDING' as const };
  }

  async complete(userId: string, sessionId: string, code: string, password: string) {
    const failures = validatePasswordPolicy(password);
    if (failures.length) throw new ForbiddenException({ code: failures[0] });
    const hash = await this.passwords.hash(password);
    const outcome = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id"=${userId}::uuid FOR UPDATE`;
      const account = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { status: true, email: true, emailVerifiedAt: true } });
      if (account.status !== 'ACTIVE' || !account.emailVerifiedAt) return false;
      if (await tx.passwordCredential.findUnique({ where: { userId }, select: { userId: true } })) return false;
      if (!await tx.oAuthIdentity.findFirst({ where: { userId, provider: 'GOOGLE' }, select: { id: true } })) return false;
      const now = new Date();
      const current = await tx.passwordEnrollmentChallenge.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
      if (!current || current.sessionId !== sessionId || current.email !== account.email || current.consumedAt || current.expiresAt <= now || current.failedAttempts >= CHALLENGE_MAX_ATTEMPTS) return false;
      if (!matchesChallenge(current.codeHash, challengeDigest('password-enroll', userId, sessionId, account.email, code))) {
        await tx.passwordEnrollmentChallenge.update({ where: { id: current.id }, data: { failedAttempts: { increment: 1 } } });
        return false;
      }
      await tx.passwordCredential.create({ data: { userId, passwordHash: hash } });
      await tx.passwordEnrollmentChallenge.updateMany({ where: { userId, consumedAt: null }, data: { consumedAt: now } });
      await tx.session.updateMany({ where: { userId, status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt: now, revokeReason: 'PASSWORD_ENROLLED' } });
      await tx.securityEvent.create({ data: { userId, type: 'PASSWORD_ENROLLED' } });
      await this.notifications.enqueueWithTx(tx, { userId, channel: 'EMAIL', destination: account.email, templateCode: 'PASSWORD_ENROLLMENT_ALERT', subject: 'Your TwiPay password is ready', text: 'A password was added to your TwiPay account and your previous sessions were signed out. If this was not you, contact TwiPay support.', idempotencyKey: `password-enroll-alert:${current.id}` });
      return true;
    });
    if (!outcome) throw new ForbiddenException({ code: 'PASSWORD_SETUP_CODE_INVALID' });
    return { ok: true };
  }
}
