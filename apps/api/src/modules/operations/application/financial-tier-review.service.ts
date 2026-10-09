import { ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { AuditService } from './audit.service.js';
import { assertTransactionalAuthorization } from './transaction-authorization.js';

/** Tier decisions NEVER enable provider flags. A distinct release process is required. */
function ensureReviewEnvironment() {
  if (process.env['NODE_ENV'] === 'production' || process.env['FINANCIAL_TIER_REVIEW_SANDBOX_ENABLED'] !== 'true') {
    throw new ServiceUnavailableException({ code: 'FINANCIAL_TIER_REVIEW_NOT_QUALIFIED' });
  }
}
function cap(name: string): bigint {
  const value = process.env[name];
  if (!value || !/^[1-9]\d{0,17}$/.test(value)) {
    throw new ServiceUnavailableException({ code: 'FINANCIAL_TIER_LIMIT_POLICY_NOT_CONFIGURED' });
  }
  return BigInt(value);
}
function assertLimits(amount: bigint, daily: bigint, tier: number) {
  if (!Number.isInteger(tier) || tier < 1 || tier > 3 || amount <= 0n || daily <= 0n ||
      amount > daily || amount > cap('FINANCIAL_TIER_MAX_PER_INTENT_MINOR') ||
      daily > cap('FINANCIAL_TIER_MAX_DAILY_DEBIT_MINOR')) {
    throw new ForbiddenException({ code: 'FINANCIAL_TIER_LIMITS_NOT_APPROVED' });
  }
}

@Injectable()
export class FinancialTierReviewService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async queue() {
    ensureReviewEnvironment();
    const reviews = await this.prisma.financialTierReview.findMany({
      where: { status: 'PREPARED' }, orderBy: { createdAt: 'asc' }, take: 100,
      select: { id: true, userId: true, status: true, proposedTier: true,
        maxPerIntentMinor: true, maxDailyDebitMinor: true, evidenceReference: true,
        preparedByUserId: true, createdAt: true },
    });
    return { reviews: reviews.map(row => ({ ...row,
      maxPerIntentMinor: row.maxPerIntentMinor.toString(),
      maxDailyDebitMinor: row.maxDailyDebitMinor.toString(),
    })), bounded: true };
  }

  /** A maker records evidence and limits for a different customer's identity. */
  async prepare(input: { userId: string; actorUserId: string; sessionId: string; tier: number;
    maxPerIntentMinor: bigint; maxDailyDebitMinor: bigint; evidenceReference: string; note: string; requestId?: string }) {
    ensureReviewEnvironment();
    assertLimits(input.maxPerIntentMinor, input.maxDailyDebitMinor, input.tier);
    if (input.userId === input.actorUserId) throw new ForbiddenException({ code: 'SELF_APPROVAL_FORBIDDEN' });
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.evidenceReference)) {
      throw new ForbiddenException({ code: 'VERIFIED_BVN_EVIDENCE_REFERENCE_REQUIRED' });
    }
    return this.prisma.$transaction(async tx => {
      await assertTransactionalAuthorization(tx, { userId: input.actorUserId, sessionId: input.sessionId,
        permission: 'ops.tiers.prepare', recentMfa: true });
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id"=${input.userId}::uuid FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: input.userId } });
      if (!user || user.status !== 'ACTIVE') throw new NotFoundException({ code: 'ELIGIBLE_CUSTOMER_NOT_FOUND' });
      const evidence = await tx.identityVerification.findUnique({ where: { id: input.evidenceReference },
        select: { userId: true, type: true, status: true, expiresAt: true } });
      if (!evidence || evidence.userId !== input.userId || evidence.type !== 'BVN' || evidence.status !== 'VERIFIED' ||
          (evidence.expiresAt && evidence.expiresAt <= new Date())) {
        throw new ForbiddenException({ code: 'VERIFIED_BVN_EVIDENCE_REQUIRED' });
      }
      const pending = await tx.financialTierReview.count({ where: { userId: input.userId, status: 'PREPARED' } });
      if (pending) throw new ConflictException({ code: 'FINANCIAL_TIER_REVIEW_ALREADY_PENDING' });
      const review = await tx.financialTierReview.create({ data: {
        userId: input.userId, preparedByUserId: input.actorUserId, proposedTier: input.tier,
        maxPerIntentMinor: input.maxPerIntentMinor, maxDailyDebitMinor: input.maxDailyDebitMinor,
        evidenceReference: input.evidenceReference, note: input.note,
      } });
      await this.audit.recordWithTx(tx, { actorUserId: input.actorUserId, action: 'FINANCIAL_TIER_REVIEW_PREPARED',
        targetType: 'financial_tier_review', targetId: review.id, requestId: input.requestId,
        reason: 'Independent risk and identity review required', afterState: { status: 'PREPARED', tier: input.tier } });
      return { id: review.id, status: review.status };
    }, { isolationLevel: 'Serializable' });
  }

  /** Only a different checker with recent MFA can apply reviewed policy. No customer-facing financial flag changes. */
  async approve(input: { reviewId: string; actorUserId: string; sessionId: string; requestId?: string }) {
    ensureReviewEnvironment();
    return this.prisma.$transaction(async tx => {
      await assertTransactionalAuthorization(tx, { userId: input.actorUserId, sessionId: input.sessionId,
        permission: 'ops.tiers.approve', recentMfa: true });
      const pointer = await tx.financialTierReview.findUnique({ where: { id: input.reviewId }, select: { userId: true } });
      if (!pointer) throw new NotFoundException({ code: 'FINANCIAL_TIER_REVIEW_NOT_FOUND' });
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id"=${pointer.userId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "financial_tier_reviews" WHERE "id"=${input.reviewId}::uuid FOR UPDATE`;
      const review = await tx.financialTierReview.findUnique({ where: { id: input.reviewId } });
      if (!review || review.status !== 'PREPARED') throw new ConflictException({ code: 'FINANCIAL_TIER_REVIEW_NOT_PENDING' });
      if (review.userId === input.actorUserId || review.preparedByUserId === input.actorUserId) {
        throw new ForbiddenException({ code: 'MAKER_CHECKER_SEPARATION_REQUIRED' });
      }
      assertLimits(review.maxPerIntentMinor, review.maxDailyDebitMinor, review.proposedTier);
      const now = new Date();
      const [user, evidence, activeMfa, existingPolicy] = await Promise.all([
        tx.user.findUnique({ where: { id: review.userId }, select: { status: true, emailVerifiedAt: true, phoneVerifiedAt: true } }),
        tx.identityVerification.findUnique({ where: { id: review.evidenceReference },
          select: { userId: true, type: true, status: true, expiresAt: true } }),
        tx.mfaCredential.count({ where: { userId: review.userId, status: 'ACTIVE' } }),
        tx.financialEligibilityPolicy.findUnique({ where: { userId: review.userId } }),
      ]);
      if (!user || user.status !== 'ACTIVE' || (!user.emailVerifiedAt && !user.phoneVerifiedAt) || !evidence || evidence.userId !== review.userId || evidence.type !== 'BVN' ||
          evidence.status !== 'VERIFIED' || (evidence.expiresAt && evidence.expiresAt <= now) || activeMfa < 1) {
        throw new ForbiddenException({ code: 'INDEPENDENT_KYC_CONTACT_MFA_EVIDENCE_REQUIRED' });
      }
      if (existingPolicy?.status === 'SUSPENDED') throw new ForbiddenException({ code: 'SUSPENDED_TIER_REQUIRES_SEPARATE_REINSTATEMENT' });
      // Approval and policy application are one serializable transaction, never a provider call.
      const policyData = { status: 'APPROVED' as const, approvedKycTier: review.proposedTier,
        maxPerIntentMinor: review.maxPerIntentMinor, maxDailyDebitMinor: review.maxDailyDebitMinor, approvedAt: now };
      await tx.financialTierReview.update({ where: { id: review.id }, data: {
        status: 'APPROVED', checkedByUserId: input.actorUserId, checkedAt: now,
      } });
      await tx.financialEligibilityPolicy.upsert({ where: { userId: review.userId },
        create: { userId: review.userId, ...policyData }, update: policyData });
      await this.audit.recordWithTx(tx, { actorUserId: input.actorUserId,
        action: 'FINANCIAL_TIER_REVIEW_APPROVED', targetType: 'financial_tier_review',
        targetId: review.id, requestId: input.requestId, reason: 'Independently checked KYC and approved tier/limits',
        beforeState: { previousStatus: existingPolicy?.status ?? 'ABSENT' },
        afterState: { status: 'APPROVED', tier: review.proposedTier } });
      return { id: review.id, status: 'APPROVED' as const };
    }, { isolationLevel: 'Serializable' });
  }

  async reject(input: { reviewId: string; actorUserId: string; sessionId: string; reason: string; requestId?: string }) {
    ensureReviewEnvironment();
    return this.prisma.$transaction(async tx => {
      await assertTransactionalAuthorization(tx, { userId: input.actorUserId, sessionId: input.sessionId,
        permission: 'ops.tiers.approve', recentMfa: true });
      await tx.$queryRaw`SELECT "id" FROM "financial_tier_reviews" WHERE "id"=${input.reviewId}::uuid FOR UPDATE`;
      const review = await tx.financialTierReview.findUnique({ where: { id: input.reviewId } });
      if (!review || review.status !== 'PREPARED') throw new ConflictException({ code: 'FINANCIAL_TIER_REVIEW_NOT_PENDING' });
      if (review.preparedByUserId === input.actorUserId || review.userId === input.actorUserId) {
        throw new ForbiddenException({ code: 'MAKER_CHECKER_SEPARATION_REQUIRED' });
      }
      await tx.financialTierReview.update({ where: { id: review.id }, data: {
        status: 'REJECTED', checkedByUserId: input.actorUserId, checkedAt: new Date(), rejectionReason: input.reason,
      } });
      await this.audit.recordWithTx(tx, { actorUserId: input.actorUserId, action: 'FINANCIAL_TIER_REVIEW_REJECTED',
        targetType: 'financial_tier_review', targetId: review.id, requestId: input.requestId,
        reason: 'Independent reviewer rejected requested tier', afterState: { status: 'REJECTED' } });
      return { id: review.id, status: 'REJECTED' as const };
    }, { isolationLevel: 'Serializable' });
  }
}
