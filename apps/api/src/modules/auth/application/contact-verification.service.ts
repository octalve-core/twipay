import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { ForbiddenException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { NotificationService } from '../../notifications/application/notification.service.js';

/** Email-only until an independently authenticated phone enrollment flow exists. */
const CODE_TTL_MS = 10 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;
const DAILY_ISSUE_CAP = 10;
const MAX_ATTEMPTS = 5;

function digest(userId: string, email: string, code: string): string {
  const secret = process.env['SESSION_HASH_PEPPER'];
  if (!secret || secret.length < 32) throw new Error('SESSION_HASH_PEPPER must be configured');
  return createHmac('sha256', secret).update('twipay:contact-email:v1\0').update(userId).update('\0').update(email).update('\0').update(code).digest('hex');
}

function matchDigest(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === 32 && right.length === 32 && timingSafeEqual(left, right);
}

@Injectable()
export class ContactVerificationService {
  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationService) {}

  /** Must be called inside the registration transaction so the challenge and outbox are durable together. */
  async issueInitialWithTx(tx: Prisma.TransactionClient, userId: string, email: string): Promise<string> {
    return this.createChallenge(tx, userId, email);
  }

  private async createChallenge(tx: Prisma.TransactionClient, userId: string, email: string): Promise<string> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const challenge = await tx.contactVerificationChallenge.create({
      data: { userId, email, codeHash: digest(userId, email, code), expiresAt: new Date(Date.now() + CODE_TTL_MS) },
      select: { id: true, expiresAt: true },
    });
    const message = await this.notifications.enqueueWithTx(tx, {
      userId, channel: 'EMAIL', templateCode: 'CONTACT_EMAIL_VERIFICATION', destination: email,
      subject: 'Verify your TwiPay email',
      text: `Welcome to TwiPay. Your verification code is ${code}. It expires in 10 minutes. If you did not create this account, you can ignore this message.`,
      idempotencyKey: `contact-email:${challenge.id}`,
    });
    await tx.securityEvent.create({ data: { userId, type: 'CONTACT_CHALLENGE_ISSUED', metadata: { challengeId: challenge.id, channel: 'EMAIL', expiresAt: challenge.expiresAt.toISOString() } } });
    return message.id;
  }

  /** Provider dispatch is best-effort; the encrypted outbox retries independently. */
  async dispatch(notificationId: string): Promise<'DELIVERED' | 'ACCEPTED' | 'PENDING'> {
    try {
      await this.notifications.deliver(notificationId);
      const notification = await this.prisma.notification.findUnique({ where: { id: notificationId }, select: { status: true } });
      return notification?.status === 'DELIVERED' ? 'DELIVERED' : notification?.status === 'ACCEPTED' ? 'ACCEPTED' : 'PENDING';
    } catch {
      // The outbox is durable; never claim a sent message following a dispatch error.
      return 'PENDING';
    }
  }

  async resend(userId: string): Promise<'DELIVERED' | 'ACCEPTED' | 'PENDING' | 'ALREADY_VERIFIED'> {
    const notificationId = await this.prisma.$transaction(async (tx) => {
      // Serializes resends/confirmations for the same account across API instances.
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, emailVerifiedAt: true, status: true } });
      if (user.status !== 'ACTIVE') throw new ForbiddenException({ code: 'ACCOUNT_UNAVAILABLE' });
      if (user.emailVerifiedAt) return null;
      const now = new Date();
      const recent = await tx.contactVerificationChallenge.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
      if (recent && now.getTime() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
        throw new HttpException({ code: 'CONTACT_RESEND_TOO_SOON', retryAfterSeconds: Math.ceil((RESEND_COOLDOWN_MS - (now.getTime() - recent.createdAt.getTime())) / 1000) }, HttpStatus.TOO_MANY_REQUESTS);
      }
      const count = await tx.contactVerificationChallenge.count({ where: { userId, createdAt: { gte: new Date(now.getTime() - 86_400_000) } } });
      if (count >= DAILY_ISSUE_CAP) throw new HttpException({ code: 'CONTACT_RESEND_LIMIT', retryAfterSeconds: 86400 }, HttpStatus.TOO_MANY_REQUESTS);
      await tx.contactVerificationChallenge.updateMany({ where: { userId, consumedAt: null }, data: { consumedAt: now } });
      return this.createChallenge(tx, userId, user.email);
    });
    return notificationId ? this.dispatch(notificationId) : 'ALREADY_VERIFIED';
  }

  async confirm(userId: string, code: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, emailVerifiedAt: true, status: true } });
      if (user.status !== 'ACTIVE') throw new ForbiddenException({ code: 'ACCOUNT_UNAVAILABLE' });
      if (user.emailVerifiedAt) throw new ForbiddenException({ code: 'CONTACT_ALREADY_VERIFIED' });
      const current = await tx.contactVerificationChallenge.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
      const now = new Date();
      if (!current || current.consumedAt || current.expiresAt <= now || current.email !== user.email || current.failedAttempts >= MAX_ATTEMPTS) {
        throw new ForbiddenException({ code: 'CONTACT_CODE_INVALID' });
      }
      if (!matchDigest(current.codeHash, digest(userId, user.email, code))) {
        // Failed-attempt accounting must commit; throwing inside this transaction would roll it back.
        await tx.contactVerificationChallenge.update({ where: { id: current.id }, data: { failedAttempts: { increment: 1 } } });
        await tx.securityEvent.create({ data: { userId, type: 'CONTACT_CHALLENGE_FAILED', metadata: { challengeId: current.id } } });
        return false;
      }
      await tx.contactVerificationChallenge.update({ where: { id: current.id }, data: { consumedAt: now } });
      await tx.contactVerificationChallenge.updateMany({ where: { userId, consumedAt: null }, data: { consumedAt: now } });
      await tx.user.update({ where: { id: userId, email: user.email }, data: { emailVerifiedAt: now } });
      await tx.securityEvent.create({ data: { userId, type: 'CONTACT_EMAIL_VERIFIED', metadata: { challengeId: current.id } } });
      return true;
    }).then((valid) => { if (!valid) throw new ForbiddenException({ code: 'CONTACT_CODE_INVALID' }); });
  }
}
