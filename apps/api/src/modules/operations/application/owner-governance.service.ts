import { ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { AuditService } from './audit.service.js';
import { ReportsService } from './reports.service.js';
import { assertTransactionalAuthorization } from './transaction-authorization.js';

/** Roles intentionally exclude SUPER_ADMIN, financial checker/maker and provider administration. */
export const DELEGABLE_STAFF_ROLES = ['SUPPORT_AGENT', 'AUDITOR', 'COMPLIANCE'] as const;
type StaffRole = typeof DELEGABLE_STAFF_ROLES[number];
type StaffAction = 'GRANT' | 'REVOKE';
const hasRole = (v: string): v is StaffRole => (DELEGABLE_STAFF_ROLES as readonly string[]).includes(v);
const maskEmail = (email: string): string => {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 2)}***@${domain}`;
};
function ensureSandboxChange() {
  if (process.env['NODE_ENV'] === 'production' || process.env['OWNER_GOVERNANCE_SANDBOX_ENABLED'] !== 'true') {
    throw new ServiceUnavailableException({ code: 'OWNER_GOVERNANCE_CHANGE_NOT_QUALIFIED' });
  }
}
/** Enforce explicit owner identity, not just the SUPER_ADMIN permission-guard bypass.
 * Lock the actor's user row after locking their current session. Role-management writes
 * lock that same user row before changing assignments, preventing a concurrent revocation.
 */
async function assertOwner(tx: any, userId: string, sessionId: string, permission: string) {
  await assertTransactionalAuthorization(tx, { userId, sessionId, permission, recentMfa: true });
  const ownerRows = await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id"=${userId}::uuid FOR SHARE`;
  if (ownerRows.length !== 1) throw new ForbiddenException({ code: 'OWNER_REQUIRED' });
  const assignment = await tx.userRole.findFirst({ where: { userId, role: { code: 'SUPER_ADMIN' } } });
  if (!assignment) throw new ForbiddenException({ code: 'OWNER_REQUIRED' });
}

@Injectable()
export class OwnerGovernanceService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly reports: ReportsService) {}

  async overview() {
    const [operations, usersByStatus, supportOpen, staffCount] = await Promise.all([
      this.reports.dashboard(),
      this.prisma.user.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.supportCase.count({ where: { status: { in: ['WAITING_SUPPORT','WAITING_CUSTOMER'] } } }),
      this.prisma.userRole.count({ where: { role: { code: { in: [...DELEGABLE_STAFF_ROLES] } } } }),
    ]);
    return { operations, customersByStatus: usersByStatus.map(v => ({ status: v.status, count: v._count._all })),
      openSupportCases: supportOpen, delegatedRoleAssignments: staffCount,
      notice: 'Counts are database observations, not proof of provider settlement or live revenue.' };
  }

  /** Bounded, masked customer discovery; no KYC documents, phone, account numbers or balances. */
  async customers(input: { search?: string }) {
    const search = input.search?.trim().toLowerCase();
    if (search && search.length > 320) throw new ForbiddenException({ code: 'INVALID_CUSTOMER_SEARCH' });
    // No unrestricted email prefix search; exact email lookup or UUID only.
    if (search && !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(search) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(search)) {
      throw new ForbiddenException({ code: 'CUSTOMER_SEARCH_MUST_BE_EXACT' });
    }
    const customers = await this.prisma.user.findMany({
      where: search ? (search.includes('@') ? { email: search } : { id: search }) : {},
      orderBy: { createdAt: 'desc' }, take: 40,
      select: { id: true, email: true, status: true, emailVerifiedAt: true, phoneVerifiedAt: true, createdAt: true,
        financialEligibility: { select: { status: true, approvedKycTier: true } } },
    });
    return { customers: customers.map(row => ({ id: row.id, emailMasked: maskEmail(row.email),
      status: row.status, contactVerified: !!(row.emailVerifiedAt || row.phoneVerifiedAt), createdAt: row.createdAt,
      financialEligibility: row.financialEligibility?.status ?? 'PENDING',
      kycTier: row.financialEligibility?.approvedKycTier ?? 0 })), bounded: true };
  }

  async staff() {
    const staff = await this.prisma.userRole.findMany({
      where: { role: { code: { in: [...DELEGABLE_STAFF_ROLES, 'SUPER_ADMIN'] } } },
      take: 100, orderBy: { assignedAt: 'desc' },
      select: { assignedAt: true, userId: true, role: { select: { code: true } },
        user: { select: { email: true, status: true } } },
    });
    return { staff: staff.map(row => ({ userId: row.userId, emailMasked: maskEmail(row.user.email),
      role: row.role.code, status: row.user.status, assignedAt: row.assignedAt })), bounded: true };
  }

  async reviews() {
    const reviews = await this.prisma.ownerStaffReview.findMany({
      where: { status: 'PREPARED' }, orderBy: { createdAt: 'asc' }, take: 100,
      select: { id: true, targetUserId: true, roleCode: true, action: true, reason: true,
        preparedByUserId: true, status: true, createdAt: true },
    });
    return { reviews, bounded: true };
  }

  async prepare(input: { targetUserId: string; roleCode: string; action: StaffAction;
    actorUserId: string; sessionId: string; reason: string; requestId?: string }) {
    ensureSandboxChange();
    if (!hasRole(input.roleCode)) throw new ForbiddenException({ code: 'ROLE_NOT_DELEGABLE' });
    if (input.targetUserId === input.actorUserId) throw new ForbiddenException({ code: 'SELF_ROLE_CHANGE_DENIED' });
    return this.prisma.$transaction(async tx => {
      await assertOwner(tx, input.actorUserId, input.sessionId, 'ops.owner.staff.prepare');
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id"=${input.targetUserId}::uuid FOR UPDATE`;
      const target = await tx.user.findUnique({ where: { id: input.targetUserId },
        select: { status: true, emailVerifiedAt: true } });
      if (!target || target.status !== 'ACTIVE' || !target.emailVerifiedAt) {
        throw new NotFoundException({ code: 'VERIFIED_ACTIVE_STAFF_ACCOUNT_REQUIRED' });
      }
      const elevated = await tx.userRole.findFirst({ where: { userId: input.targetUserId, role: { code: 'SUPER_ADMIN' } } });
      if (elevated) throw new ForbiddenException({ code: 'OWNER_ROLE_TARGET_RESTRICTED' });
      const role = await tx.role.findUnique({ where: { code: input.roleCode } });
      if (!role) throw new NotFoundException({ code: 'STAFF_ROLE_NOT_CONFIGURED' });
      const existing = await tx.userRole.findUnique({ where: { userId_roleId: { userId: input.targetUserId, roleId: role.id } } });
      if (input.action === 'GRANT' ? !!existing : !existing) {
        throw new ConflictException({ code: 'STAFF_ROLE_STATE_CHANGED' });
      }
      if (await tx.ownerStaffReview.count({ where: { targetUserId: input.targetUserId, roleCode: input.roleCode, status: 'PREPARED' } })) {
        throw new ConflictException({ code: 'STAFF_REVIEW_ALREADY_PENDING' });
      }
      const review = await tx.ownerStaffReview.create({ data: {
        targetUserId: input.targetUserId, roleCode: input.roleCode, action: input.action,
        preparedByUserId: input.actorUserId, reason: input.reason,
      } });
      await this.audit.recordWithTx(tx, { actorUserId: input.actorUserId, action: 'OWNER_STAFF_CHANGE_PREPARED',
        targetType: 'owner_staff_review', targetId: review.id, reason: input.reason, requestId: input.requestId,
        afterState: { role: input.roleCode, action: input.action, status: 'PREPARED' } });
      return { id: review.id, status: review.status };
    }, { isolationLevel: 'Serializable' });
  }

  async decide(input: { reviewId: string; actorUserId: string; sessionId: string;
    decision: 'APPROVED' | 'REJECTED'; reason?: string; requestId?: string }) {
    ensureSandboxChange();
    return this.prisma.$transaction(async tx => {
      await assertOwner(tx, input.actorUserId, input.sessionId, 'ops.owner.staff.approve');
      const pointer = await tx.ownerStaffReview.findUnique({ where: { id: input.reviewId }, select: { targetUserId: true } });
      if (!pointer) throw new NotFoundException({ code: 'STAFF_REVIEW_NOT_FOUND' });
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id"=${pointer.targetUserId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "owner_staff_reviews" WHERE "id"=${input.reviewId}::uuid FOR UPDATE`;
      const review = await tx.ownerStaffReview.findUnique({ where: { id: input.reviewId } });
      if (!review || review.status !== 'PREPARED') throw new ConflictException({ code: 'STAFF_REVIEW_ALREADY_DECIDED' });
      if (input.decision === 'APPROVED' && review.createdAt && review.createdAt.getTime() < Date.now() - 7 * 86400_000) {
        throw new ConflictException({ code: 'STAFF_REVIEW_EXPIRED' });
      }
      if (review.preparedByUserId === input.actorUserId || review.targetUserId === input.actorUserId) {
        throw new ForbiddenException({ code: 'INDEPENDENT_OWNER_CHECKER_REQUIRED' });
      }
      if (!hasRole(review.roleCode)) throw new ForbiddenException({ code: 'ROLE_NOT_DELEGABLE' });
      if (input.decision === 'REJECTED' && (!input.reason || input.reason.length < 20)) {
        throw new ForbiddenException({ code: 'REJECTION_EVIDENCE_REQUIRED' });
      }
      const elevated = await tx.userRole.findFirst({ where: { userId: review.targetUserId, role: { code: 'SUPER_ADMIN' } } });
      if (elevated) throw new ForbiddenException({ code: 'OWNER_ROLE_TARGET_RESTRICTED' });
      const role = await tx.role.findUnique({ where: { code: review.roleCode } });
      if (!role) throw new NotFoundException({ code: 'STAFF_ROLE_NOT_CONFIGURED' });
      if (input.decision === 'APPROVED') {
        const target = await tx.user.findUnique({ where: { id: review.targetUserId }, select: { status: true, emailVerifiedAt: true } });
        if (!target || target.status !== 'ACTIVE' || !target.emailVerifiedAt) {
          throw new ForbiddenException({ code: 'VERIFIED_ACTIVE_STAFF_ACCOUNT_REQUIRED' });
        }
        const existing = await tx.userRole.findUnique({ where: { userId_roleId: { userId: review.targetUserId, roleId: role.id } } });
        if (review.action === 'GRANT') {
          if (existing) throw new ConflictException({ code: 'STAFF_ROLE_STATE_CHANGED' });
          await tx.userRole.create({ data: { userId: review.targetUserId, roleId: role.id, assignedBy: review.preparedByUserId } });
        } else {
          if (!existing) throw new ConflictException({ code: 'STAFF_ROLE_STATE_CHANGED' });
          await tx.userRole.delete({ where: { userId_roleId: { userId: review.targetUserId, roleId: role.id } } });
        }
        // Existing access tokens cannot continue with stale RBAC assignments.
        await tx.session.updateMany({ where: { userId: review.targetUserId, status: 'ACTIVE' },
          data: { status: 'REVOKED', revokedAt: new Date(), revokeReason: 'OWNER_STAFF_ROLE_CHANGED' } });
      }
      const result = await tx.ownerStaffReview.update({ where: { id: review.id }, data: {
        status: input.decision, checkedByUserId: input.actorUserId, checkedAt: new Date(),
        rejectionReason: input.decision === 'REJECTED' ? input.reason : null,
      } });
      await this.audit.recordWithTx(tx, { actorUserId: input.actorUserId,
        action: input.decision === 'APPROVED' ? 'OWNER_STAFF_CHANGE_APPROVED' : 'OWNER_STAFF_CHANGE_REJECTED',
        targetType: 'owner_staff_review', targetId: result.id, requestId: input.requestId,
        reason: input.decision === 'REJECTED' ? input.reason : review.reason,
        afterState: { role: review.roleCode, action: review.action, status: result.status } });
      return { id: result.id, status: result.status };
    }, { isolationLevel: 'Serializable' });
  }
  /** Two-owner review required before suspending an ACTIVE customer account.
   * This deliberately does not alter wallet state, financial eligibility, holds or journals.
   * Reactivation requires a separate future compliance/identity restoration workflow.
   */
  async suspensionReviews() {
    const reviews = await this.prisma.ownerCustomerSuspensionReview.findMany({
      where: { status: 'PREPARED' }, orderBy: { createdAt: 'asc' }, take: 100,
      select: { id: true, targetUserId: true, reason: true, preparedByUserId: true, createdAt: true },
    });
    return { reviews, bounded: true };
  }

  async prepareSuspension(input: { targetUserId: string; actorUserId: string;
    sessionId: string; reason: string; requestId?: string }) {
    ensureSandboxChange();
    if (input.actorUserId === input.targetUserId) throw new ForbiddenException({ code: 'SELF_SUSPENSION_FORBIDDEN' });
    return this.prisma.$transaction(async tx => {
      await assertOwner(tx, input.actorUserId, input.sessionId, 'ops.owner.staff.prepare');
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id"=${input.targetUserId}::uuid FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: input.targetUserId }, select: { status: true } });
      if (!user || user.status !== 'ACTIVE') throw new ConflictException({ code: 'CUSTOMER_NOT_ACTIVE' });
      if (await tx.userRole.findFirst({ where: { userId: input.targetUserId, role: { code: 'SUPER_ADMIN' } } })) {
        throw new ForbiddenException({ code: 'OWNER_ACCOUNT_RESTRICTION_DENIED' });
      }
      if (await tx.ownerCustomerSuspensionReview.count({ where: { targetUserId: input.targetUserId, status: 'PREPARED' } })) {
        throw new ConflictException({ code: 'CUSTOMER_SUSPENSION_ALREADY_PENDING' });
      }
      const review = await tx.ownerCustomerSuspensionReview.create({ data: {
        targetUserId: input.targetUserId, preparedByUserId: input.actorUserId, reason: input.reason,
      } });
      await this.audit.recordWithTx(tx, { actorUserId: input.actorUserId, action: 'OWNER_CUSTOMER_SUSPENSION_PREPARED',
        targetType: 'owner_customer_suspension_review', targetId: review.id, reason: input.reason,
        requestId: input.requestId });
      return { id: review.id, status: review.status };
    }, { isolationLevel: 'Serializable' });
  }

  async decideSuspension(input: { reviewId: string; actorUserId: string; sessionId: string;
    decision: 'APPROVED' | 'REJECTED'; reason?: string; requestId?: string }) {
    ensureSandboxChange();
    if (input.decision === 'REJECTED' && (!input.reason || input.reason.length < 20)) {
      throw new ForbiddenException({ code: 'REJECTION_EVIDENCE_REQUIRED' });
    }
    return this.prisma.$transaction(async tx => {
      await assertOwner(tx, input.actorUserId, input.sessionId, 'ops.owner.staff.approve');
      const pointer = await tx.ownerCustomerSuspensionReview.findUnique({ where: { id: input.reviewId }, select: { targetUserId: true } });
      if (!pointer) throw new NotFoundException({ code: 'SUSPENSION_REVIEW_NOT_FOUND' });
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id"=${pointer.targetUserId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "owner_customer_suspension_reviews" WHERE "id"=${input.reviewId}::uuid FOR UPDATE`;
      const review = await tx.ownerCustomerSuspensionReview.findUnique({ where: { id: input.reviewId } });
      if (!review || review.status !== 'PREPARED') throw new ConflictException({ code: 'SUSPENSION_REVIEW_ALREADY_DECIDED' });
      if (input.decision === 'APPROVED' && review.createdAt && review.createdAt.getTime() < Date.now() - 7 * 86400_000) {
        throw new ConflictException({ code: 'SUSPENSION_REVIEW_EXPIRED' });
      }
      if (review.preparedByUserId === input.actorUserId || review.targetUserId === input.actorUserId) {
        throw new ForbiddenException({ code: 'INDEPENDENT_OWNER_CHECKER_REQUIRED' });
      }
      if (await tx.userRole.findFirst({ where: { userId: review.targetUserId, role: { code: 'SUPER_ADMIN' } } })) {
        throw new ForbiddenException({ code: 'OWNER_ACCOUNT_RESTRICTION_DENIED' });
      }
      if (input.decision === 'APPROVED') {
        const updated = await tx.user.updateMany({ where: { id: review.targetUserId, status: 'ACTIVE' },
          data: { status: 'SUSPENDED' } });
        if (updated.count !== 1) throw new ConflictException({ code: 'CUSTOMER_STATUS_CHANGED' });
        await tx.session.updateMany({ where: { userId: review.targetUserId, status: 'ACTIVE' },
          data: { status: 'REVOKED', revokedAt: new Date(), revokeReason: 'OWNER_APPROVED_ACCOUNT_SUSPENSION' } });
      }
      const result = await tx.ownerCustomerSuspensionReview.update({ where: { id: review.id }, data: {
        status: input.decision, checkedByUserId: input.actorUserId, checkedAt: new Date(),
        rejectionReason: input.decision === 'REJECTED' ? input.reason : null,
      } });
      await this.audit.recordWithTx(tx, { actorUserId: input.actorUserId,
        action: input.decision === 'APPROVED' ? 'OWNER_CUSTOMER_SUSPENSION_APPROVED' : 'OWNER_CUSTOMER_SUSPENSION_REJECTED',
        targetType: 'owner_customer_suspension_review', targetId: result.id,
        reason: input.decision === 'REJECTED' ? input.reason : review.reason, requestId: input.requestId });
      return { id: result.id, status: result.status };
    }, { isolationLevel: 'Serializable' });
  }

}
