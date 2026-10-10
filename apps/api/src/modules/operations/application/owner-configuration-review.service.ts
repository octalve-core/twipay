import { createHash } from 'node:crypto';
import { ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { AuditService } from './audit.service.js';
import { assertTransactionalAuthorization } from './transaction-authorization.js';

export const OwnerBrand = z.object({
  productName: z.string().trim().min(2).max(120), legalName: z.string().trim().min(2).max(180),
  domain: z.string().trim().min(3).max(255), supportEmail: z.email().max(320),
  logoUrl: z.url().max(1000).nullable().optional(), primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/), privacyUrl: z.url().max(1000).nullable().optional(),
  termsUrl: z.url().max(1000).nullable().optional(),
}).strict();
export const OwnerDeployment = z.object({
  productSlug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  edition: z.enum(['TWIPAY_OWNED','WHITE_LABEL','ENTERPRISE_SOURCE']),
  licensedTo: z.string().trim().min(2).max(180), status: z.enum(['ACTIVE','SUSPENDED','EXPIRED']),
  allowedModules: z.array(z.string().trim().min(2).max(80)).min(1).max(50),
  supportMode: z.enum(['SELF_MANAGED','OCTALVE_MANAGED','ENTERPRISE_SUPPORT']),
  licenseReference: z.string().trim().max(160).nullable().optional(),
  validUntil: z.iso.datetime().nullable().optional(),
}).strict();
export const OwnerFlagDisable = z.object({ key: z.string().min(3).max(120).regex(/^[a-z][a-z0-9_.-]{2,119}$/),
  enabled: z.literal(false), public: z.boolean(), description: z.string().max(500).optional(),
}).strict();
export const ConfigProposal = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('BRAND'), data: OwnerBrand, reason: z.string().trim().min(20).max(500) }).strict(),
  z.object({ kind: z.literal('DEPLOYMENT'), data: OwnerDeployment, reason: z.string().trim().min(20).max(500) }).strict(),
  z.object({ kind: z.literal('FLAG_DISABLE'), data: OwnerFlagDisable, reason: z.string().trim().min(20).max(500) }).strict(),
]);
export type ConfigProposalInput = z.infer<typeof ConfigProposal>;
function gate() {
  if (process.env['NODE_ENV'] === 'production' || process.env['OWNER_CONFIGURATION_SANDBOX_ENABLED'] !== 'true') {
    throw new ServiceUnavailableException({ code: 'OWNER_CONFIGURATION_NOT_QUALIFIED' });
  }
}
async function owner(tx: any, userId: string, sessionId: string, permission: string) {
  await assertTransactionalAuthorization(tx, { userId, sessionId, permission, recentMfa: true });
  await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id"=${userId}::uuid FOR SHARE`;
  if (!await tx.userRole.findFirst({ where: { userId, role: { code: 'SUPER_ADMIN' } } })) {
    throw new ForbiddenException({ code: 'OWNER_REQUIRED' });
  }
}
function summary(row: any, kind: string): unknown {
  if (!row) return null;
  if (kind === 'BRAND') return {
    productName: row.productName, legalName: row.legalName, domain: row.domain, supportEmail: row.supportEmail,
    logoUrl: row.logoUrl, primaryColor: row.primaryColor, accentColor: row.accentColor, privacyUrl: row.privacyUrl, termsUrl: row.termsUrl,
  };
  if (kind === 'DEPLOYMENT') return {
    productSlug: row.productSlug, edition: row.edition, licensedTo: row.licensedTo, status: row.status,
    allowedModules: row.allowedModules, supportMode: row.supportMode,
    licenseReference: row.licenseReference, validUntil: row.validUntil?.toISOString() ?? null,
  };
  return { key: row.key, enabled: row.enabled, public: row.public, description: row.description, config: row.config ?? null };
}
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Lock the mutable business record before comparing the prepared baseline.
 * Rows absent at preparation are still protected by Serializable conflicts and unique keys.
 * No dynamic table name interpolation is permitted in a SQL query.
 */
async function lockTarget(tx: any, kind: string, key: string): Promise<void> {
  if (kind === 'BRAND') await tx.$queryRaw`SELECT "key" FROM "brand_configurations" WHERE "key"='default' FOR UPDATE`;
  else if (kind === 'DEPLOYMENT') await tx.$queryRaw`SELECT "key" FROM "deployment_profiles" WHERE "key"='default' FOR UPDATE`;
  else if (kind === 'FLAG_DISABLE') await tx.$queryRaw`SELECT "key" FROM "feature_flags" WHERE "key"=${key} FOR UPDATE`;
  else throw new ForbiddenException({ code: 'CONFIG_TYPE_NOT_PERMITTED' });
}
async function current(tx: any, kind: string, key: string) {
  if (kind === 'BRAND') return tx.brandConfiguration.findUnique({ where: { key: 'default' } });
  if (kind === 'DEPLOYMENT') return tx.deploymentProfile.findUnique({ where: { key: 'default' } });
  return tx.featureFlag.findUnique({ where: { key } });
}

@Injectable()
export class OwnerConfigurationReviewService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async queue() {
    return { reviews: await this.prisma.ownerConfigReview.findMany({ where: { status: 'PREPARED' },
      take: 100, orderBy: { createdAt: 'asc' }, select: { id: true, kind: true, targetKey: true,
        preparedByUserId: true, reason: true, createdAt: true, expiresAt: true, status: true } }), bounded: true };
  }

  async prepare(input: ConfigProposalInput & { actorUserId: string; sessionId: string; requestId?: string }) {
    gate();
    const proposal = ConfigProposal.parse({ kind: input.kind, data: input.data, reason: input.reason }); // never persist transport metadata
    const targetKey = proposal.kind === 'FLAG_DISABLE' ? proposal.data.key : 'default';
    return this.prisma.$transaction(async tx => {
      await owner(tx, input.actorUserId, input.sessionId, 'ops.owner.staff.prepare');
      const pending = await tx.ownerConfigReview.count({ where: { kind: proposal.kind, targetKey, status: 'PREPARED' } });
      if (pending) throw new ConflictException({ code: 'CONFIG_CHANGE_ALREADY_PENDING' });
      const before = await current(tx, proposal.kind, targetKey);
      if (proposal.kind === 'FLAG_DISABLE' && !before) throw new NotFoundException({ code: 'FLAG_NOT_FOUND' });
      const review = await tx.ownerConfigReview.create({ data: {
        kind: proposal.kind, targetKey, payload: proposal.data as Prisma.InputJsonValue,
        baselineHash: digest(summary(before, proposal.kind)), preparedByUserId: input.actorUserId,
        reason: proposal.reason, expiresAt: new Date(Date.now() + 7 * 86400_000),
      } });
      await this.audit.recordWithTx(tx, { actorUserId: input.actorUserId, action: 'OWNER_CONFIG_PREPARED',
        targetType: 'owner_config_review', targetId: review.id, reason: proposal.reason,
        afterState: { kind: review.kind, targetKey, status: 'PREPARED' }, requestId: input.requestId });
      return { id: review.id, status: review.status };
    }, { isolationLevel: 'Serializable' });
  }

  async decide(input: { reviewId: string; actorUserId: string; sessionId: string;
    decision: 'APPROVED' | 'REJECTED'; reason?: string; requestId?: string }) {
    gate();
    return this.prisma.$transaction(async tx => {
      await owner(tx, input.actorUserId, input.sessionId, 'ops.owner.staff.approve');
      await tx.$queryRaw`SELECT "id" FROM "owner_config_reviews" WHERE "id"=${input.reviewId}::uuid FOR UPDATE`;
      const review = await tx.ownerConfigReview.findUnique({ where: { id: input.reviewId } });
      if (!review || review.status !== 'PREPARED') throw new ConflictException({ code: 'CONFIG_REVIEW_NOT_PENDING' });
      if (review.preparedByUserId === input.actorUserId) throw new ForbiddenException({ code: 'INDEPENDENT_OWNER_CHECKER_REQUIRED' });
      if (input.decision === 'APPROVED' && review.expiresAt <= new Date()) throw new ConflictException({ code: 'CONFIG_REVIEW_EXPIRED' });
      if (input.decision === 'REJECTED' && (!input.reason || input.reason.trim().length < 20)) throw new ForbiddenException({ code: 'REJECTION_EVIDENCE_REQUIRED' });
      if (input.decision === 'APPROVED') {
        if (!['BRAND','DEPLOYMENT','FLAG_DISABLE'].includes(review.kind)) throw new ForbiddenException({ code: 'CONFIG_TYPE_NOT_PERMITTED' });
        const raw = { kind: review.kind, data: review.payload, reason: review.reason };
        const parsed = ConfigProposal.parse(raw); // revalidate persisted JSON at execution
        await lockTarget(tx, review.kind, review.targetKey);
        const before = await current(tx, review.kind, review.targetKey);
        if (digest(summary(before, review.kind)) !== review.baselineHash) throw new ConflictException({ code: 'CONFIG_CHANGED_SINCE_REVIEW' });
        if (parsed.kind === 'FLAG_DISABLE') {
          if (!before || parsed.data.key !== review.targetKey) throw new ConflictException({ code: 'CONFIG_TARGET_MISMATCH' });
          await tx.featureFlag.update({ where: { key: review.targetKey }, data: {
            enabled: false, public: parsed.data.public, description: parsed.data.description, updatedByUserId: input.actorUserId,
          } });
        } else if (parsed.kind === 'BRAND') {
          await tx.brandConfiguration.upsert({ where: { key: 'default' },
            create: { key: 'default', ...parsed.data, updatedByUserId: input.actorUserId },
            update: { ...parsed.data, updatedByUserId: input.actorUserId },
          });
        } else {
          const data = { ...parsed.data, validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : null };
          await tx.deploymentProfile.upsert({ where: { key: 'default' },
            create: { key: 'default', ...data, updatedByUserId: input.actorUserId },
            update: { ...data, updatedByUserId: input.actorUserId },
          });
        }
      }
      const updated = await tx.ownerConfigReview.update({ where: { id: review.id }, data: {
        status: input.decision, checkedByUserId: input.actorUserId, checkedAt: new Date(),
        rejectionReason: input.decision === 'REJECTED' ? input.reason : null,
      } });
      await this.audit.recordWithTx(tx, { actorUserId: input.actorUserId,
        action: input.decision === 'APPROVED' ? 'OWNER_CONFIG_APPROVED' : 'OWNER_CONFIG_REJECTED',
        targetType: 'owner_config_review', targetId: review.id, reason: input.reason ?? review.reason,
        beforeState: { baselineHash: review.baselineHash },
        afterState: { kind: review.kind, targetKey: review.targetKey, status: updated.status }, requestId: input.requestId });
      return { id: updated.id, status: updated.status };
    }, { isolationLevel: 'Serializable' });
  }
}
