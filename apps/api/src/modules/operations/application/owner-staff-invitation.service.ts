import { ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { decryptSensitiveString, encryptSensitiveString, fingerprintSensitiveValue } from '@twipay/security';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { NotificationService } from '../../notifications/application/notification.service.js';
import { AuditService } from './audit.service.js';
import { assertTransactionalAuthorization } from './transaction-authorization.js';
import { DELEGABLE_STAFF_ROLES } from './owner-governance.service.js';

function enabled() {
  if (process.env['NODE_ENV'] === 'production' || process.env['OWNER_GOVERNANCE_SANDBOX_ENABLED'] !== 'true') {
    throw new ServiceUnavailableException({ code: 'STAFF_INVITATIONS_NOT_RUNTIME_QUALIFIED' });
  }
}
function emailData(email: string) {
  const canonical = email.trim().toLowerCase();
  if (canonical.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(canonical)) {
    throw new ForbiddenException({ code: 'VALID_INVITATION_EMAIL_REQUIRED' });
  }
  const [local, domain] = canonical.split('@') as [string, string];
  return { canonical, fingerprint: fingerprintSensitiveValue(canonical, process.env['PII_FINGERPRINT_KEY']!),
    masked: `${local.slice(0, 2)}***@${domain}` };
}
async function owner(tx: any, userId: string, sessionId: string, permission: string) {
  await assertTransactionalAuthorization(tx, { userId, sessionId, permission, recentMfa: true });
  await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id"=${userId}::uuid FOR SHARE`;
  if (!await tx.userRole.findFirst({ where: { userId, role: { code: 'SUPER_ADMIN' } } })) {
    throw new ForbiddenException({ code: 'OWNER_REQUIRED' });
  }
}

@Injectable()
export class OwnerStaffInvitationService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService,
    private readonly notifications: NotificationService) {}

  async queue() {
    return { invitations: await this.prisma.ownerStaffInvitation.findMany({
      where: { status: { in: ['PREPARED','APPROVED'] } }, take: 100, orderBy: { createdAt: 'desc' },
      select: { id: true, emailMasked: true, roleCode: true, status: true, preparedByUserId: true,
        checkedByUserId: true, createdAt: true, expiresAt: true },
    }), bounded: true };
  }

  async prepare(input: { email: string; roleCode: string; reason: string; actorUserId: string;
    sessionId: string; requestId?: string }) {
    enabled();
    if (!(DELEGABLE_STAFF_ROLES as readonly string[]).includes(input.roleCode)) throw new ForbiddenException({ code: 'ROLE_NOT_DELEGABLE' });
    const email = emailData(input.email);
    return this.prisma.$transaction(async tx => {
      await owner(tx, input.actorUserId, input.sessionId, 'ops.owner.staff.prepare');
      const self = await tx.user.findUnique({ where: { id: input.actorUserId }, select: { email: true } });
      if (self?.email.toLowerCase() === email.canonical) throw new ForbiddenException({ code: 'SELF_INVITATION_FORBIDDEN' });
      if (await tx.ownerStaffInvitation.count({ where: { emailFingerprint: email.fingerprint, roleCode: input.roleCode,
        status: { in: ['PREPARED','APPROVED'] } } })) throw new ConflictException({ code: 'INVITATION_ALREADY_OPEN' });
      const existing = await tx.user.findUnique({ where: { email: email.canonical } });
      if (existing && await tx.userRole.findFirst({ where: { userId: existing.id, role: { code: 'SUPER_ADMIN' } } })) {
        throw new ForbiddenException({ code: 'OWNER_INVITATION_TARGET_FORBIDDEN' });
      }
      const invitation = await tx.ownerStaffInvitation.create({ data: {
        emailCiphertext: encryptSensitiveString(email.canonical, process.env['DATA_ENCRYPTION_KEY']!),
        emailFingerprint: email.fingerprint, emailMasked: email.masked, roleCode: input.roleCode,
        preparedByUserId: input.actorUserId, reason: input.reason,
        expiresAt: new Date(Date.now() + 7 * 86400_000),
      } });
      await this.audit.recordWithTx(tx, { actorUserId: input.actorUserId, action: 'OWNER_INVITATION_PREPARED',
        targetType: 'owner_staff_invitation', targetId: invitation.id, reason: input.reason,
        afterState: { role: invitation.roleCode, status: 'PREPARED' }, requestId: input.requestId });
      return { id: invitation.id, status: invitation.status };
    }, { isolationLevel: 'Serializable' });
  }

  async decide(input: { invitationId: string; actorUserId: string; sessionId: string;
    action: 'APPROVED' | 'REJECTED' | 'REVOKED'; reason?: string; requestId?: string }) {
    enabled();
    return this.prisma.$transaction(async tx => {
      await owner(tx, input.actorUserId, input.sessionId, 'ops.owner.staff.approve');
      await tx.$queryRaw`SELECT "id" FROM "owner_staff_invitations" WHERE "id"=${input.invitationId}::uuid FOR UPDATE`;
      const invitation = await tx.ownerStaffInvitation.findUnique({ where: { id: input.invitationId } });
      if (!invitation) throw new NotFoundException({ code: 'INVITATION_NOT_FOUND' });
      const eligible = input.action === 'REVOKED' ? invitation.status === 'APPROVED' : invitation.status === 'PREPARED';
      if (!eligible) throw new ConflictException({ code: 'INVITATION_STATE_CHANGED' });
      if (invitation.preparedByUserId === input.actorUserId && input.action !== 'REVOKED') {
        throw new ForbiddenException({ code: 'INDEPENDENT_OWNER_CHECKER_REQUIRED' });
      }
      if (input.action === 'APPROVED' && invitation.expiresAt <= new Date()) throw new ConflictException({ code: 'INVITATION_EXPIRED' });
      if (input.action !== 'APPROVED' && (!input.reason || input.reason.trim().length < 20)) {
        throw new ForbiddenException({ code: 'REVOCATION_EVIDENCE_REQUIRED' });
      }
      if (input.action === 'APPROVED') {
        const email = decryptSensitiveString(invitation.emailCiphertext, process.env['DATA_ENCRYPTION_KEY']!);
        const target = await tx.user.findUnique({ where: { email } });
        if (target && await tx.userRole.findFirst({ where: { userId: target.id, role: { code: 'SUPER_ADMIN' } } })) {
          throw new ForbiddenException({ code: 'OWNER_INVITATION_TARGET_FORBIDDEN' });
        }
        // Approval queues a generic invitation notice; delivery must be separately verified.
        await this.notifications.enqueueWithTx(tx, { channel: 'EMAIL', destination: email,
          templateCode: 'STAFF_INVITATION_APPROVED', subject: 'TwiPay staff invitation',
          text: 'A limited TwiPay staff invitation has been approved. Create or sign in to your TwiPay account, verify your email, enable MFA, and accept the invitation from your account. This email does not grant access.',
          idempotencyKey: `owner-invite:${invitation.id}` });
      }
      const updated = await tx.ownerStaffInvitation.update({ where: { id: invitation.id }, data: {
        status: input.action,
        ...(invitation.checkedByUserId ? {} : { checkedByUserId: input.actorUserId, checkedAt: new Date() }),
        ...(input.action === 'REJECTED' ? { rejectionReason: input.reason } : {}),
      } });
      await this.audit.recordWithTx(tx, { actorUserId: input.actorUserId, action: `OWNER_INVITATION_${input.action}`,
        targetType: 'owner_staff_invitation', targetId: invitation.id,
        reason: input.reason ?? invitation.reason, afterState: { role: updated.roleCode, status: updated.status }, requestId: input.requestId });
      return { id: updated.id, status: updated.status };
    }, { isolationLevel: 'Serializable' });
  }

  async mine(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, emailVerifiedAt: true, status: true } });
    if (!user || !user.emailVerifiedAt || user.status !== 'ACTIVE') return { invitations: [] };
    const email = emailData(user.email);
    const invitations = await this.prisma.ownerStaffInvitation.findMany({
      where: { emailFingerprint: email.fingerprint, status: 'APPROVED', expiresAt: { gt: new Date() } },
      select: { id: true, roleCode: true, expiresAt: true }, take: 10,
    });
    return { invitations };
  }

  async accept(input: { invitationId: string; userId: string; sessionId: string; requestId?: string }) {
    enabled();
    return this.prisma.$transaction(async tx => {
      await assertTransactionalAuthorization(tx, { userId: input.userId, sessionId: input.sessionId, recentMfa: true });
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id"=${input.userId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "owner_staff_invitations" WHERE "id"=${input.invitationId}::uuid FOR UPDATE`;
      const [user, invitation] = await Promise.all([
        tx.user.findUnique({ where: { id: input.userId }, select: { email: true, status: true, emailVerifiedAt: true } }),
        tx.ownerStaffInvitation.findUnique({ where: { id: input.invitationId } }),
      ]);
      if (!invitation || invitation.status !== 'APPROVED' || invitation.expiresAt <= new Date()) {
        throw new NotFoundException({ code: 'INVITATION_UNAVAILABLE' });
      }
      if (!user || user.status !== 'ACTIVE' || !user.emailVerifiedAt ||
          emailData(user.email).fingerprint !== invitation.emailFingerprint ||
          decryptSensitiveString(invitation.emailCiphertext, process.env['DATA_ENCRYPTION_KEY']!) !== user.email.toLowerCase()) {
        throw new ForbiddenException({ code: 'INVITATION_ACCOUNT_MISMATCH' });
      }
      if (await tx.userRole.findFirst({ where: { userId: input.userId, role: { code: 'SUPER_ADMIN' } } })) {
        throw new ForbiddenException({ code: 'OWNER_INVITATION_TARGET_FORBIDDEN' });
      }
      if (!(DELEGABLE_STAFF_ROLES as readonly string[]).includes(invitation.roleCode)) throw new ForbiddenException({ code: 'ROLE_NOT_DELEGABLE' });
      const role = await tx.role.findUnique({ where: { code: invitation.roleCode } });
      if (!role) throw new NotFoundException({ code: 'STAFF_ROLE_NOT_CONFIGURED' });
      if (await tx.userRole.findUnique({ where: { userId_roleId: { userId: input.userId, roleId: role.id } } })) {
        throw new ConflictException({ code: 'STAFF_ROLE_ALREADY_ASSIGNED' });
      }
      await tx.userRole.create({ data: { userId: input.userId, roleId: role.id, assignedBy: invitation.checkedByUserId } });
      await tx.ownerStaffInvitation.update({ where: { id: invitation.id }, data: {
        status: 'ACCEPTED', acceptedByUserId: input.userId, acceptedAt: new Date(),
      } });
      await tx.session.updateMany({ where: { userId: input.userId, status: 'ACTIVE' },
        data: { status: 'REVOKED', revokedAt: new Date(), revokeReason: 'STAFF_INVITATION_ACCEPTED' } });
      await this.audit.recordWithTx(tx, { actorUserId: input.userId, action: 'STAFF_INVITATION_ACCEPTED',
        targetType: 'owner_staff_invitation', targetId: invitation.id,
        afterState: { role: invitation.roleCode, status: 'ACCEPTED' }, requestId: input.requestId });
      return { status: 'ACCEPTED', signInAgain: true };
    }, { isolationLevel: 'Serializable' });
  }
}
