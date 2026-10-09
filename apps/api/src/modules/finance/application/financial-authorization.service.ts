import { ForbiddenException, HttpException, HttpStatus, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { SESSION_IDLE_TTL_SECONDS } from '@twipay/security';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { PasswordHasher } from '../../auth/infrastructure/password-hasher.js';
import { pinMaterial } from '../../auth/application/transaction-pin.service.js';
import type { TwiPayRequestPrincipal } from '../../auth/presentation/session-auth.guard.js';

const MAX_FAILURES = 5;
const LOCK_MS = 30 * 60_000;
const PIN_FORMAT = /^\d{4}$/;
const OPEN_DEBITS = ['CREATED', 'AUTHORIZED', 'FUNDS_RESERVED', 'PROVIDER_SUBMITTED', 'PROCESSING', 'UNKNOWN', 'SUCCEEDED'] as const;

type FinancialIntentKind = 'TRANSFER' | 'BILL_PAYMENT' | 'EVENT_PURCHASE' | 'FUNDING' | 'VIRTUAL_ACCOUNT';
/** Never serialize this server-issued object to the client, an audit log, or an idempotency fingerprint. */
export interface FinancialAuthorization {
  readonly userId: string;
  readonly sessionId: string;
  readonly pinChangedAt: Date;
  readonly authorizedAt: Date;
  readonly intent: FinancialIntentKind;
  readonly amountMinor: bigint;
}

function unavailable(): never {
  throw new ServiceUnavailableException({ code: 'FINANCIAL_OPERATIONS_NOT_RELEASE_QUALIFIED' });
}
function denied(code: string): never { throw new ForbiddenException({ code }); }
function ensureSandbox(): void {
  // A product flag or a valid PIN can never activate an unqualified payment provider.
  if (process.env['NODE_ENV'] === 'production' || process.env['FINANCIAL_AUTHORIZATION_SANDBOX_ENABLED'] !== 'true') unavailable();
}
function positiveSeconds(raw: string | undefined, fallback: number): number {
  const n = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 3600) unavailable();
  return n;
}

@Injectable()
export class FinancialAuthorizationService {
  constructor(private readonly prisma: PrismaService, private readonly hasher: PasswordHasher) {}

  private async checkPolicyWithTx(tx: Prisma.TransactionClient, input: {
    userId: string; sessionId: string; amountMinor: bigint; intent: FinancialIntentKind;
  }, now: Date): Promise<void> {
    if (input.amountMinor < 0n || (input.intent !== 'VIRTUAL_ACCOUNT' && input.amountMinor === 0n)) denied('INVALID_FINANCIAL_AMOUNT');
    // Serializes policy/limit evaluation across debits for the same customer.
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id"=${input.userId}::uuid FOR UPDATE`;
    // Serialize session revocation/rotation with financial holds and debits.
    await tx.$queryRaw`SELECT "id" FROM "sessions" WHERE "id"=${input.sessionId}::uuid FOR UPDATE`;
    // Any later approval/revocation update must serialize with this policy decision.
    await tx.$queryRaw`SELECT "userId" FROM "financial_eligibility_policies" WHERE "userId"=${input.userId}::uuid FOR UPDATE`;
    const [user, session, mfaCount, verifiedBvn, policy] = await Promise.all([
      tx.user.findUnique({ where: { id: input.userId }, select: { status: true, emailVerifiedAt: true, phoneVerifiedAt: true } }),
      tx.session.findUnique({ where: { id: input.sessionId }, select: { userId: true, status: true, expiresAt: true, lastSeenAt: true, mfaSatisfiedAt: true } }),
      tx.mfaCredential.count({ where: { userId: input.userId, status: 'ACTIVE' } }),
      tx.identityVerification.count({ where: { userId: input.userId, type: 'BVN', status: 'VERIFIED' } }),
      tx.financialEligibilityPolicy.findUnique({ where: { userId: input.userId } }),
    ]);
    if (!user || user.status !== 'ACTIVE') denied('FINANCIAL_ACCOUNT_NOT_ELIGIBLE');
    if (!user.emailVerifiedAt && !user.phoneVerifiedAt) denied('CONTACT_VERIFICATION_REQUIRED');
    const idleMs = positiveSeconds(process.env['SESSION_IDLE_TTL_SECONDS'], SESSION_IDLE_TTL_SECONDS) * 1000;
    if (!session || session.userId !== input.userId || session.status !== 'ACTIVE' || session.expiresAt <= now || session.lastSeenAt <= new Date(now.getTime() - idleMs)) denied('FINANCIAL_SESSION_EXPIRED');
    if (mfaCount < 1 || !session.mfaSatisfiedAt || session.mfaSatisfiedAt > now || session.mfaSatisfiedAt <= new Date(now.getTime() - positiveSeconds(process.env['MFA_STEP_UP_MAX_AGE_SECONDS'], 600) * 1000)) denied('FINANCIAL_MFA_REQUIRED');
    if (verifiedBvn < 1) denied('VERIFIED_BVN_REQUIRED');
    if (!policy || policy.status !== 'APPROVED' || !policy.approvedAt || policy.approvedKycTier < 1 || policy.approvedKycTier > 3 || policy.maxPerIntentMinor <= 0n || policy.maxDailyDebitMinor <= 0n) denied('FINANCIAL_KYC_TIER_NOT_APPROVED');
    if (input.amountMinor > policy.maxPerIntentMinor) denied('FINANCIAL_TRANSACTION_LIMIT_EXCEEDED');
    if (input.amountMinor > 0n) {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const daily = await tx.financialTransaction.aggregate({
        where: { userId: input.userId, type: { in: ['TRANSFER', 'BILL_PAYMENT', 'EVENT_PURCHASE'] }, status: { in: [...OPEN_DEBITS] }, createdAt: { gte: start } },
        _sum: { amountMinor: true, feeMinor: true },
      });
      const committed = (daily._sum.amountMinor ?? 0n) + (daily._sum.feeMinor ?? 0n);
      // A funding/provisioning request cannot consume the debit budget but still requires tier, PIN and MFA.
      const debit = input.intent === 'FUNDING' || input.intent === 'VIRTUAL_ACCOUNT' ? 0n : input.amountMinor;
      if (committed + debit > policy.maxDailyDebitMinor) denied('FINANCIAL_DAILY_LIMIT_EXCEEDED');
    }
  }

  async authorize(input: {
    principal: TwiPayRequestPrincipal; transactionPin: string; amountMinor: bigint; intent: FinancialIntentKind;
  }): Promise<FinancialAuthorization> {
    ensureSandbox();
    const { userId, sessionId } = input.principal;
    // The PIN is not included in request hashes, provider payloads, or error responses.
    if (typeof input.transactionPin !== 'string' || !PIN_FORMAT.test(input.transactionPin)) denied('PIN_AUTHORIZATION_FAILED');
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      await this.checkPolicyWithTx(tx, { userId, sessionId, amountMinor: input.amountMinor, intent: input.intent }, now);
      const pin = await tx.transactionPinCredential.findUnique({ where: { userId } });
      if (!pin) return { status: 'MISSING' as const };
      if (pin.lockedUntil && pin.lockedUntil > now) return { status: 'LOCKED' as const };
      const correct = await this.hasher.verify(pin.pinHash, pinMaterial(userId, input.transactionPin));
      if (!correct) {
        const failures = pin.failedAttempts + 1;
        const lock = failures >= MAX_FAILURES;
        await tx.transactionPinCredential.update({ where: { userId }, data: { failedAttempts: failures, lockedUntil: lock ? new Date(now.getTime() + LOCK_MS) : null } });
        await tx.securityEvent.create({ data: { userId, type: lock ? 'TRANSACTION_PIN_LOCKED' : 'TRANSACTION_PIN_FAILED' } });
        return { status: lock ? 'LOCKED' as const : 'INVALID' as const };
      }
      await tx.transactionPinCredential.update({ where: { userId }, data: { failedAttempts: 0, lockedUntil: null } });
      await tx.securityEvent.create({ data: { userId, type: 'FINANCIAL_PIN_AUTHORIZED', metadata: { intent: input.intent } } });
      return { status: 'OK' as const, changedAt: pin.changedAt };
    });
    if (result.status === 'LOCKED') throw new HttpException({ code: 'PIN_TEMPORARILY_LOCKED' }, HttpStatus.TOO_MANY_REQUESTS);
    if (result.status !== 'OK') denied(result.status === 'MISSING' ? 'TRANSACTION_PIN_REQUIRED' : 'PIN_AUTHORIZATION_FAILED');
    return { userId, sessionId, pinChangedAt: result.changedAt, authorizedAt: now, intent: input.intent, amountMinor: input.amountMinor };
  }

  /** Run immediately before any hold, ledger debit, provisioning record or provider submission.
   *  No amount/balance/eligibility data from a browser is trusted here. */
  async assertCurrentWithTx(tx: Prisma.TransactionClient, authorization: FinancialAuthorization, amountMinor: bigint, actor: { userId: string; intent: FinancialIntentKind }): Promise<void> {
    ensureSandbox();
    if (authorization.userId !== actor.userId || authorization.intent !== actor.intent || authorization.amountMinor !== amountMinor) denied('FINANCIAL_INTENT_BINDING_MISMATCH');
    const now = new Date();
    if (now.getTime() - authorization.authorizedAt.getTime() > 30_000 || authorization.authorizedAt > now) denied('FINANCIAL_AUTHORIZATION_EXPIRED');
    await this.checkPolicyWithTx(tx, { userId: authorization.userId, sessionId: authorization.sessionId, intent: authorization.intent, amountMinor }, now);
    const credential = await tx.transactionPinCredential.findUnique({ where: { userId: authorization.userId }, select: { changedAt: true, lockedUntil: true } });
    if (!credential || credential.changedAt.getTime() !== authorization.pinChangedAt.getTime() || (credential.lockedUntil && credential.lockedUntil > now)) denied('FINANCIAL_AUTHORIZATION_EXPIRED');
  }
}
