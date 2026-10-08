import {
  ConflictException,
  Injectable,
  TooManyRequestsException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  buildTotpOtpAuthUri,
  decryptSensitiveString,
  encryptSensitiveString,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  normalizeRecoveryCode,
  verifyTotpCode,
} from '@twipay/security';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { PasswordHasher } from '../infrastructure/password-hasher.js';
import { SessionService, type SessionMaterial } from './session.service.js';

type CredentialRow = {
  id: string;
  userId: string;
  status: 'PENDING' | 'ACTIVE' | 'DISABLED';
  secretCiphertext: string;
  lastAcceptedTimeStep: bigint | null;
  failedAttempts: number;
  lockedUntil: Date | null;
  enrollmentStartedAt: Date;
};

type FactorResult =
  | { kind: 'SUCCESS'; credentialId: string; method: 'TOTP' | 'RECOVERY'; acceptedStep?: bigint }
  | { kind: 'INVALID'; credentialId: string; lockedUntil: Date | null }
  | { kind: 'LOCKED'; credentialId: string; lockedUntil: Date }
  | { kind: 'NOT_CONFIGURED' };

function positiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordHasher,
    private readonly sessions: SessionService,
  ) {}

  private encryptionKey(): string {
    const value = process.env['DATA_ENCRYPTION_KEY'];
    if (!value) throw new Error('DATA_ENCRYPTION_KEY_REQUIRED');
    return value;
  }

  private recoveryKey(): string {
    const value = process.env['MFA_RECOVERY_HMAC_KEY'];
    if (!value || value.length < 32) throw new Error('MFA_RECOVERY_HMAC_KEY must contain at least 32 characters');
    return value;
  }

  private issuer(): string {
    return (process.env['MFA_TOTP_ISSUER'] ?? 'TwiPay').trim() || 'TwiPay';
  }

  private maxFailures(): number {
    return positiveIntEnv('MFA_MAX_FAILED_ATTEMPTS', 5);
  }

  private lockSeconds(): number {
    return positiveIntEnv('MFA_LOCK_SECONDS', 300);
  }

  private enrollmentTtlSeconds(): number {
    return positiveIntEnv('MFA_ENROLLMENT_TTL_SECONDS', 600);
  }

  async status(userId: string) {
    const active = await this.prisma.mfaCredential.findFirst({
      where: { userId, status: 'ACTIVE' },
      select: { id: true, enabledAt: true, recoveryCodes: { where: { usedAt: null }, select: { id: true } } },
    });
    const pending = active ? null : await this.prisma.mfaCredential.findFirst({
      where: { userId, status: 'PENDING' },
      select: { enrollmentStartedAt: true },
    });
    return {
      enabled: Boolean(active),
      enabledAt: active?.enabledAt ?? null,
      recoveryCodesRemaining: active?.recoveryCodes.length ?? 0,
      enrollmentPending: Boolean(pending),
      enrollmentStartedAt: pending?.enrollmentStartedAt ?? null,
    };
  }

  async beginEnrollment(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { passwordCredential: true },
    });
    if (!user || user.status !== 'ACTIVE' || !user.passwordCredential) {
      throw new UnauthorizedException({ code: 'MFA_REAUTHENTICATION_REQUIRED' });
    }
    const passwordOk = await this.passwords.verify(user.passwordCredential.passwordHash, password);
    if (!passwordOk) throw new UnauthorizedException({ code: 'MFA_REAUTHENTICATION_FAILED' });

    const secret = generateTotpSecret();
    const now = new Date();
    const credential = await this.prisma.$transaction(async (tx) => {
      const current = await tx.mfaCredential.findFirst({
        where: { userId, status: { in: ['PENDING', 'ACTIVE'] } },
        orderBy: { createdAt: 'desc' },
      });
      if (current?.status === 'ACTIVE') throw new ConflictException({ code: 'MFA_ALREADY_ENABLED' });
      if (current?.status === 'PENDING') {
        await tx.mfaCredential.update({
          where: { id: current.id },
          data: { status: 'DISABLED', disabledAt: now, disabledReason: 'ENROLLMENT_RESTARTED' },
        });
      }
      const created = await tx.mfaCredential.create({
        data: { userId, secretCiphertext: encryptSensitiveString(secret, this.encryptionKey()), enrollmentStartedAt: now },
        select: { id: true, enrollmentStartedAt: true },
      });
      await tx.securityEvent.create({
        data: { userId, type: 'MFA_ENROLLMENT_STARTED', metadata: { credentialId: created.id } },
      });
      return created;
    });

    return {
      credentialId: credential.id,
      manualSecret: secret,
      otpauthUri: buildTotpOtpAuthUri({ issuer: this.issuer(), accountName: user.email, secretBase32: secret }),
      expiresAt: new Date(credential.enrollmentStartedAt.getTime() + this.enrollmentTtlSeconds() * 1000),
    };
  }

  async confirmEnrollment(userId: string, sessionId: string, code: string): Promise<{ recoveryCodes: readonly string[]; session: SessionMaterial }> {
    const recoveryCodes = generateRecoveryCodes(10);
    const now = new Date();
    const outcome = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<CredentialRow[]>`
        SELECT "id","userId","status","secretCiphertext","lastAcceptedTimeStep","failedAttempts","lockedUntil","enrollmentStartedAt"
        FROM "mfa_credentials"
        WHERE "userId"=${userId}::uuid AND "status"='PENDING'
        ORDER BY "createdAt" DESC
        LIMIT 1 FOR UPDATE`;
      const credential = rows[0];
      if (!credential) return { kind: 'NOT_CONFIGURED' as const };
      if (credential.enrollmentStartedAt.getTime() + this.enrollmentTtlSeconds() * 1000 <= now.getTime()) {
        await tx.mfaCredential.update({ where: { id: credential.id }, data: { status: 'DISABLED', disabledAt: now, disabledReason: 'ENROLLMENT_EXPIRED' } });
        return { kind: 'EXPIRED' as const };
      }
      if (credential.lockedUntil && credential.lockedUntil > now) return { kind: 'LOCKED' as const, lockedUntil: credential.lockedUntil };

      const secret = decryptSensitiveString(credential.secretCiphertext, this.encryptionKey());
      const acceptedStep = verifyTotpCode({ secretBase32: secret, code, now, window: 1, lastAcceptedTimeStep: credential.lastAcceptedTimeStep });
      if (acceptedStep === null) {
        const baseAttempts = credential.lockedUntil && credential.lockedUntil <= now ? 0 : credential.failedAttempts;
        const failedAttempts = baseAttempts + 1;
        const lockedUntil = failedAttempts >= this.maxFailures() ? new Date(now.getTime() + this.lockSeconds() * 1000) : null;
        await tx.mfaCredential.update({ where: { id: credential.id }, data: { failedAttempts, lockedUntil } });
        await tx.securityEvent.create({ data: { userId, type: 'MFA_CHALLENGE_FAILED', metadata: { credentialId: credential.id, phase: 'ENROLLMENT_CONFIRM', locked: Boolean(lockedUntil) } } });
        return { kind: 'INVALID' as const, lockedUntil };
      }

      await tx.mfaCredential.update({
        where: { id: credential.id },
        data: { status: 'ACTIVE', enabledAt: now, lastAcceptedTimeStep: acceptedStep, failedAttempts: 0, lockedUntil: null },
      });
      await tx.mfaRecoveryCode.createMany({
        data: recoveryCodes.map((recoveryCode) => ({ credentialId: credential.id, codeHash: hashRecoveryCode(recoveryCode, this.recoveryKey()) })),
      });
      await tx.securityEvent.create({ data: { userId, type: 'MFA_ENABLED', metadata: { credentialId: credential.id } } });
      return { kind: 'SUCCESS' as const };
    });

    if (outcome.kind === 'NOT_CONFIGURED') throw new ConflictException({ code: 'MFA_ENROLLMENT_NOT_FOUND' });
    if (outcome.kind === 'EXPIRED') throw new ConflictException({ code: 'MFA_ENROLLMENT_EXPIRED' });
    if (outcome.kind === 'LOCKED') throw new TooManyRequestsException({ code: 'MFA_TEMPORARILY_LOCKED', retryAt: outcome.lockedUntil });
    if (outcome.kind === 'INVALID') {
      if (outcome.lockedUntil) throw new TooManyRequestsException({ code: 'MFA_TEMPORARILY_LOCKED', retryAt: outcome.lockedUntil });
      throw new UnauthorizedException({ code: 'MFA_CODE_INVALID' });
    }

    const session = await this.sessions.rotate(sessionId, { mfaSatisfiedAt: now, reason: 'MFA_ENROLLMENT_CONFIRMED' });
    return { recoveryCodes, session };
  }

  async challenge(userId: string, sessionId: string, code: string): Promise<{ method: 'TOTP' | 'RECOVERY'; session: SessionMaterial }> {
    const now = new Date();
    const result = await this.verifyActiveFactor(userId, code, now, 'STEP_UP');
    this.assertFactorSuccess(result);
    const session = await this.sessions.rotate(sessionId, { mfaSatisfiedAt: now, reason: 'MFA_STEP_UP' });
    return { method: result.method, session };
  }

  async regenerateRecoveryCodes(userId: string, sessionId: string, code: string): Promise<{ recoveryCodes: readonly string[]; session: SessionMaterial }> {
    const now = new Date();
    const verified = await this.verifyActiveFactor(userId, code, now, 'RECOVERY_REGENERATION');
    this.assertFactorSuccess(verified);
    const recoveryCodes = generateRecoveryCodes(10);
    await this.prisma.$transaction(async (tx) => {
      // The factor challenge was performed in an earlier transaction. Recheck
      // under a row lock to prevent regenerating codes for a concurrently
      // disabled credential (or a replacement enrollment).
      const credential = await tx.$queryRaw<Array<{ id: string; status: string }>>`
        SELECT "id", "status" FROM "mfa_credentials"
        WHERE "id"=${verified.credentialId}::uuid AND "userId"=${userId}::uuid
        FOR UPDATE`;
      if (credential[0]?.status !== 'ACTIVE') throw new ConflictException({ code: 'MFA_STATE_CHANGED' });
      await tx.mfaRecoveryCode.updateMany({ where: { credentialId: verified.credentialId, usedAt: null }, data: { usedAt: now } });
      await tx.mfaRecoveryCode.createMany({
        data: recoveryCodes.map((recoveryCode) => ({ credentialId: verified.credentialId, codeHash: hashRecoveryCode(recoveryCode, this.recoveryKey()) })),
      });
      await tx.securityEvent.create({ data: { userId, type: 'MFA_CHALLENGE_SUCCEEDED', metadata: { credentialId: verified.credentialId, action: 'RECOVERY_CODES_REGENERATED' } } });
    });
    const session = await this.sessions.rotate(sessionId, { mfaSatisfiedAt: now, reason: 'MFA_RECOVERY_CODES_REGENERATED' });
    return { recoveryCodes, session };
  }

  async disable(userId: string, sessionId: string, code: string, reason = 'USER_DISABLED'): Promise<{ session: SessionMaterial }> {
    const now = new Date();
    const verified = await this.verifyActiveFactor(userId, code, now, 'DISABLE');
    this.assertFactorSuccess(verified);
    const disabled = await this.prisma.$transaction(async (tx) => {
      const result = await tx.mfaCredential.updateMany({
        where: { id: verified.credentialId, userId, status: 'ACTIVE' },
        data: { status: 'DISABLED', disabledAt: now, disabledReason: reason, failedAttempts: 0, lockedUntil: null },
      });
      if (result.count !== 1) return false;
      await tx.mfaRecoveryCode.updateMany({ where: { credentialId: verified.credentialId, usedAt: null }, data: { usedAt: now } });
      await tx.securityEvent.create({ data: { userId, type: 'MFA_DISABLED', metadata: { credentialId: verified.credentialId, reason } } });
      return true;
    });
    if (!disabled) throw new ConflictException({ code: 'MFA_STATE_CHANGED' });

    const session = await this.sessions.rotate(sessionId, { mfaSatisfiedAt: null, reason: 'MFA_DISABLED_ROTATION' });
    await this.sessions.revokeOtherUserSessions(userId, session.sessionId, 'MFA_DISABLED_OTHER_SESSION_REVOKE');
    return { session };
  }

  private assertFactorSuccess(result: FactorResult): asserts result is Extract<FactorResult, { kind: 'SUCCESS' }> {
    if (result.kind === 'SUCCESS') return;
    if (result.kind === 'NOT_CONFIGURED') throw new ConflictException({ code: 'MFA_NOT_CONFIGURED' });
    if (result.kind === 'LOCKED') throw new TooManyRequestsException({ code: 'MFA_TEMPORARILY_LOCKED', retryAt: result.lockedUntil });
    if (result.lockedUntil) throw new TooManyRequestsException({ code: 'MFA_TEMPORARILY_LOCKED', retryAt: result.lockedUntil });
    throw new UnauthorizedException({ code: 'MFA_CODE_INVALID' });
  }

  private async verifyActiveFactor(userId: string, code: string, now: Date, purpose: string): Promise<FactorResult> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<CredentialRow[]>`
        SELECT "id","userId","status","secretCiphertext","lastAcceptedTimeStep","failedAttempts","lockedUntil","enrollmentStartedAt"
        FROM "mfa_credentials"
        WHERE "userId"=${userId}::uuid AND "status"='ACTIVE'
        ORDER BY "createdAt" DESC
        LIMIT 1 FOR UPDATE`;
      const credential = rows[0];
      if (!credential) return { kind: 'NOT_CONFIGURED' as const };
      if (credential.lockedUntil && credential.lockedUntil > now) {
        return { kind: 'LOCKED' as const, credentialId: credential.id, lockedUntil: credential.lockedUntil };
      }

      let method: 'TOTP' | 'RECOVERY' | null = null;
      let acceptedStep: bigint | undefined;
      if (/^\d{6}$/.test(code.trim())) {
        const secret = decryptSensitiveString(credential.secretCiphertext, this.encryptionKey());
        const step = verifyTotpCode({ secretBase32: secret, code, now, window: 1, lastAcceptedTimeStep: credential.lastAcceptedTimeStep });
        if (step !== null) { method = 'TOTP'; acceptedStep = step; }
      } else {
        const normalized = normalizeRecoveryCode(code);
        if (normalized) {
          const codeHash = hashRecoveryCode(normalized, this.recoveryKey());
          const recovery = await tx.mfaRecoveryCode.findUnique({ where: { codeHash }, select: { id: true, credentialId: true, usedAt: true } });
          if (recovery?.credentialId === credential.id && !recovery.usedAt) {
            const consumed = await tx.mfaRecoveryCode.updateMany({ where: { id: recovery.id, credentialId: credential.id, usedAt: null }, data: { usedAt: now } });
            if (consumed.count === 1) method = 'RECOVERY';
          }
        }
      }

      if (!method) {
        const baseAttempts = credential.lockedUntil && credential.lockedUntil <= now ? 0 : credential.failedAttempts;
        const failedAttempts = baseAttempts + 1;
        const lockedUntil = failedAttempts >= this.maxFailures() ? new Date(now.getTime() + this.lockSeconds() * 1000) : null;
        await tx.mfaCredential.update({ where: { id: credential.id }, data: { failedAttempts, lockedUntil } });
        await tx.securityEvent.create({ data: { userId, type: 'MFA_CHALLENGE_FAILED', metadata: { credentialId: credential.id, purpose, locked: Boolean(lockedUntil) } } });
        return { kind: 'INVALID' as const, credentialId: credential.id, lockedUntil };
      }

      await tx.mfaCredential.update({
        where: { id: credential.id },
        data: { ...(acceptedStep !== undefined ? { lastAcceptedTimeStep: acceptedStep } : {}), failedAttempts: 0, lockedUntil: null },
      });
      await tx.securityEvent.create({
        data: { userId, type: method === 'RECOVERY' ? 'MFA_RECOVERY_USED' : 'MFA_CHALLENGE_SUCCEEDED', metadata: { credentialId: credential.id, purpose, method } },
      });
      return { kind: 'SUCCESS' as const, credentialId: credential.id, method, ...(acceptedStep !== undefined ? { acceptedStep } : {}) };
    });
  }
}
