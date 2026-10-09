import { createHmac } from 'node:crypto';
import { ConflictException, ForbiddenException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { PasswordHasher } from '../infrastructure/password-hasher.js';
import { NotificationService } from '../../notifications/application/notification.service.js';
import {
  CHALLENGE_COOLDOWN_MS, CHALLENGE_DAILY_LIMIT, CHALLENGE_MAX_ATTEMPTS, CHALLENGE_TTL_MS,
  challengeDigest, generateEightDigitCode, matchesChallenge,
} from './credential-challenge.js';

const MAX_FAILURES = 5;
const LOCK_MS = 30 * 60_000;
const PIN_FORMAT = /^\d{4}$/;
const WEAK_PINS = new Set(['0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321', '0123', '9876']);

function pinMaterial(userId: string, pin: string): string {
  // A secret independent from password/session hashing makes offline enumeration of a four-digit PIN infeasible.
  const key = process.env['TRANSACTION_PIN_PEPPER'];
  if (!key || key.length < 32) throw new Error('TRANSACTION_PIN_PEPPER_REQUIRED');
  return createHmac('sha256', key).update('twipay:transaction-pin:v1\0').update(userId).update('\0').update(pin).digest('hex');
}
function validatePin(pin: string): void {
  if (!PIN_FORMAT.test(pin) || WEAK_PINS.has(pin)) throw new ForbiddenException({ code: 'PIN_WEAK_OR_INVALID' });
}
function denied(): ForbiddenException { return new ForbiddenException({ code: 'PIN_AUTHORIZATION_FAILED' }); }

@Injectable()
export class TransactionPinService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hasher: PasswordHasher,
    private readonly notifications: NotificationService,
  ) {}

  async status(userId: string): Promise<'SET' | 'NOT_SET'> {
    return (await this.prisma.transactionPinCredential.findUnique({ where: { userId }, select: { userId: true } })) ? 'SET' : 'NOT_SET';
  }

  private async passwordMatches(tx: Prisma.TransactionClient, userId: string, password: string): Promise<boolean> {
    const credential = await tx.passwordCredential.findUnique({ where: { userId }, select: { passwordHash: true } });
    return Boolean(credential && await this.hasher.verify(credential.passwordHash, password));
  }

  /** Account password + contact-verified authenticated session (+ MFA guard when enabled) are required. */
  async setPin(userId: string, password: string, pin: string) {
    validatePin(pin);
    const pinHash = await this.hasher.hash(pinMaterial(userId, pin));
    const ok = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id"=${userId}::uuid FOR UPDATE`;
      if (!await this.passwordMatches(tx, userId, password)) return false;
      const current = await tx.transactionPinCredential.findUnique({ where: { userId }, select: { userId: true } });
      if (current) throw new ConflictException({ code: 'PIN_ALREADY_SET' });
      await tx.transactionPinCredential.create({ data: { userId, pinHash } });
      await tx.securityEvent.create({ data: { userId, type: 'TRANSACTION_PIN_SET' } });
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
      await this.notifications.enqueueWithTx(tx, { userId, channel: 'EMAIL', destination: user.email, templateCode: 'TRANSACTION_PIN_SECURITY_ALERT', subject: 'Your TwiPay transaction PIN is set', text: 'A transaction PIN was set on your TwiPay account. If this was not you, contact TwiPay support.', idempotencyKey: `pin-set:${userId}` });
      return true;
    });
    if (!ok) throw denied();
    return { status: 'SET' as const };
  }

  /** PIN verification and lockout operate atomically under the same per-user row lock. */
  async changePin(userId: string, password: string, oldPin: string, newPin: string) {
    validatePin(newPin);
    if (!PIN_FORMAT.test(oldPin)) throw denied();
    const pinHash = await this.hasher.hash(pinMaterial(userId, newPin));
    const outcome = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id"=${userId}::uuid FOR UPDATE`;
      const current = await tx.transactionPinCredential.findUnique({ where: { userId } });
      if (!current) return 'MISSING';
      const now = new Date();
      if (current.lockedUntil && current.lockedUntil > now) return 'LOCKED';
      // A correct old PIN must not permit changing the credential without password reauthentication.
      if (!await this.passwordMatches(tx, userId, password)) return 'DENIED';
      const valid = await this.hasher.verify(current.pinHash, pinMaterial(userId, oldPin));
      if (!valid) {
        const failures = (current.lockedUntil ? 0 : current.failedAttempts) + 1;
        const lockedUntil = failures >= MAX_FAILURES ? new Date(now.getTime() + LOCK_MS) : null;
        await tx.transactionPinCredential.update({ where: { userId }, data: { failedAttempts: failures, lockedUntil } });
        await tx.securityEvent.create({ data: { userId, type: lockedUntil ? 'TRANSACTION_PIN_LOCKED' : 'TRANSACTION_PIN_FAILED' } });
        return lockedUntil ? 'LOCKED' : 'DENIED';
      }
      if (await this.hasher.verify(current.pinHash, pinMaterial(userId, newPin))) return 'DENIED';
      await tx.transactionPinCredential.update({ where: { userId }, data: { pinHash, changedAt: now, failedAttempts: 0, lockedUntil: null } });
      await tx.transactionPinResetChallenge.updateMany({ where: { userId, consumedAt: null }, data: { consumedAt: now } });
      await tx.securityEvent.create({ data: { userId, type: 'TRANSACTION_PIN_CHANGED' } });
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
      await this.notifications.enqueueWithTx(tx, { userId, channel: 'EMAIL', destination: user.email, templateCode: 'TRANSACTION_PIN_SECURITY_ALERT', subject: 'Your TwiPay transaction PIN was changed', text: 'Your transaction PIN was changed. If this was not you, contact TwiPay support.', idempotencyKey: `pin-changed:${userId}:${now.getTime()}` });
      return 'OK';
    });
    if (outcome === 'MISSING') throw new ConflictException({ code: 'PIN_NOT_SET' });
    if (outcome === 'LOCKED') throw new HttpException({ code: 'PIN_TEMPORARILY_LOCKED' }, HttpStatus.TOO_MANY_REQUESTS);
    if (outcome !== 'OK') throw denied();
    return { status: 'SET' as const };
  }

  async requestReset(userId: string, sessionId: string, password: string) {
    const issued = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id"=${userId}::uuid FOR UPDATE`;
      const account = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, emailVerifiedAt: true, status: true } });
      if (account.status !== 'ACTIVE' || !account.emailVerifiedAt || !await this.passwordMatches(tx, userId, password)) return false;
      if (!await tx.transactionPinCredential.findUnique({ where: { userId }, select: { userId: true } })) return false;
      const now = new Date();
      const last = await tx.transactionPinResetChallenge.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
      if (last && now.getTime() - last.createdAt.getTime() < CHALLENGE_COOLDOWN_MS) return false;
      const count = await tx.transactionPinResetChallenge.count({ where: { userId, createdAt: { gte: new Date(now.getTime() - 86_400_000) } } });
      if (count >= CHALLENGE_DAILY_LIMIT) return false;
      await tx.transactionPinResetChallenge.updateMany({ where: { userId, consumedAt: null }, data: { consumedAt: now } });
      const code = generateEightDigitCode();
      const challenge = await tx.transactionPinResetChallenge.create({ data: { userId, sessionId, email: account.email, codeHash: challengeDigest('pin-reset', userId, sessionId, account.email, code), expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS) } });
      await this.notifications.enqueueWithTx(tx, { userId, channel: 'EMAIL', destination: account.email, templateCode: 'TRANSACTION_PIN_RESET', subject: 'Reset your TwiPay transaction PIN', text: `Your TwiPay PIN reset code is ${code}. It expires in 10 minutes. Never share this code.`, idempotencyKey: `pin-reset:${challenge.id}` });
      await tx.securityEvent.create({ data: { userId, type: 'TRANSACTION_PIN_RESET_REQUESTED' } });
      return true;
    });
    if (!issued) throw denied();
    // Enqueued, not an assertion of actual provider delivery.
    return { deliveryStatus: 'PENDING' as const };
  }

  async completeReset(userId: string, sessionId: string, password: string, code: string, newPin: string) {
    validatePin(newPin);
    const newHash = await this.hasher.hash(pinMaterial(userId, newPin));
    const done = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id"=${userId}::uuid FOR UPDATE`;
      const now = new Date();
      const account = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, emailVerifiedAt: true, status: true } });
      if (account.status !== 'ACTIVE' || !account.emailVerifiedAt || !await this.passwordMatches(tx, userId, password)) return false;
      const current = await tx.transactionPinResetChallenge.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
      if (!current || current.sessionId !== sessionId || current.email !== account.email || current.consumedAt || current.expiresAt <= now || current.failedAttempts >= CHALLENGE_MAX_ATTEMPTS) return false;
      if (!matchesChallenge(current.codeHash, challengeDigest('pin-reset', userId, sessionId, account.email, code))) {
        await tx.transactionPinResetChallenge.update({ where: { id: current.id }, data: { failedAttempts: { increment: 1 } } });
        return false;
      }
      const credential = await tx.transactionPinCredential.findUnique({ where: { userId } });
      if (!credential || await this.hasher.verify(credential.pinHash, pinMaterial(userId, newPin))) return false;
      await tx.transactionPinCredential.update({ where: { userId }, data: { pinHash: newHash, changedAt: now, failedAttempts: 0, lockedUntil: null } });
      await tx.transactionPinResetChallenge.updateMany({ where: { userId, consumedAt: null }, data: { consumedAt: now } });
      await tx.session.updateMany({ where: { userId, status: 'ACTIVE', id: { not: sessionId } }, data: { status: 'REVOKED', revokedAt: now, revokeReason: 'TRANSACTION_PIN_RESET' } });
      await tx.securityEvent.create({ data: { userId, type: 'TRANSACTION_PIN_RESET' } });
      await this.notifications.enqueueWithTx(tx, { userId, channel: 'EMAIL', destination: account.email, templateCode: 'TRANSACTION_PIN_SECURITY_ALERT', subject: 'Your TwiPay transaction PIN was reset', text: 'Your TwiPay transaction PIN was reset. Other devices were signed out. If this was not you, contact TwiPay support.', idempotencyKey: `pin-reset-alert:${current.id}` });
      return true;
    });
    if (!done) throw denied();
    return { status: 'SET' as const };
  }
}
