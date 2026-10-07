import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { AuditService } from './audit.service.js';

type ProductSemantics = { category: string; currency: string; customerIdentifierType: string; fixedAmountMinor: bigint|null; minAmountMinor: bigint|null; maxAmountMinor: bigint|null };
function mappingCompatible(source: ProductSemantics, target: ProductSemantics): boolean {
  return source.category === target.category
    && source.currency === target.currency
    && source.customerIdentifierType === target.customerIdentifierType
    && source.fixedAmountMinor === target.fixedAmountMinor
    && source.minAmountMinor === target.minAmountMinor
    && source.maxAmountMinor === target.maxAmountMinor;
}

function offerView<T extends { id: string; productId: string; providerCode: string; providerProductCode: string; providerBillerCode: string; priority: number; estimatedCostMinor: bigint | null; active: boolean; requiresValidation: boolean; lastSyncedAt: Date }>(offer: T) {
  return { id: offer.id, productId: offer.productId, providerCode: offer.providerCode, providerProductCode: offer.providerProductCode, providerBillerCode: offer.providerBillerCode, priority: offer.priority, estimatedCostMinor: offer.estimatedCostMinor?.toString() ?? null, active: offer.active, requiresValidation: offer.requiresValidation, lastSyncedAt: offer.lastSyncedAt };
}

function healthView<T extends { id: string; providerCode: string; capability: string; circuitState: string; consecutiveFailures: number; successCount: bigint; failureCount: bigint; openedAt: Date | null; cooldownUntil: Date | null }>(row: T) {
  return { id: row.id, providerCode: row.providerCode, capability: row.capability, circuitState: row.circuitState, consecutiveFailures: row.consecutiveFailures, successCount: row.successCount.toString(), failureCount: row.failureCount.toString(), openedAt: row.openedAt, cooldownUntil: row.cooldownUntil };
}

@Injectable()
export class ProviderOperationsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async snapshot() {
    const [health, offers] = await Promise.all([
      this.prisma.providerCapabilityHealth.findMany({ orderBy: [{ capability: 'asc' }, { providerCode: 'asc' }] }),
      this.prisma.billProviderOffer.findMany({ include: { product: true }, orderBy: [{ providerCode: 'asc' }, { priority: 'desc' }], take: 500 }),
    ]);
    return {
      health: health.map((row) => ({ ...row, successCount: row.successCount.toString(), failureCount: row.failureCount.toString() })),
      offers: offers.map((offer) => ({ ...offer, estimatedCostMinor: offer.estimatedCostMinor?.toString() ?? null, product: { ...offer.product, fixedAmountMinor: offer.product.fixedAmountMinor?.toString() ?? null, minAmountMinor: offer.product.minAmountMinor?.toString() ?? null, maxAmountMinor: offer.product.maxAmountMinor?.toString() ?? null } })),
    };
  }

  async updateOffer(input: { offerId: string; actorUserId: string; active?: boolean; priority?: number; estimatedCostMinor?: bigint|null; reason: string; requestId?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.billProviderOffer.findUnique({ where: { id: input.offerId } });
      if (!before) throw new NotFoundException({ code: 'PROVIDER_OFFER_NOT_FOUND' });
      const updated = await tx.billProviderOffer.update({ where: { id: before.id }, data: {
        ...(input.active !== undefined ? { active: input.active } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.estimatedCostMinor !== undefined ? { estimatedCostMinor: input.estimatedCostMinor } : {}),
      } });
      await this.audit.recordWithTx(tx, { actorUserId: input.actorUserId, action: 'PROVIDER_OFFER_CONTROL_UPDATED', targetType: 'bill_provider_offer', targetId: before.id, reason: input.reason, requestId: input.requestId, beforeState: { active: before.active, priority: before.priority, estimatedCostMinor: before.estimatedCostMinor?.toString() ?? null }, afterState: { active: updated.active, priority: updated.priority, estimatedCostMinor: updated.estimatedCostMinor?.toString() ?? null } });
      return offerView(updated);
    });
  }

  async resetCircuit(input: { healthId: string; actorUserId: string; reason: string; requestId?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.providerCapabilityHealth.findUnique({ where: { id: input.healthId } });
      if (!before) throw new NotFoundException({ code: 'PROVIDER_HEALTH_NOT_FOUND' });
      const updated = await tx.providerCapabilityHealth.update({ where: { id: before.id }, data: { circuitState: 'CLOSED', consecutiveFailures: 0, openedAt: null, cooldownUntil: null } });
      await this.audit.recordWithTx(tx, { actorUserId: input.actorUserId, action: 'PROVIDER_CIRCUIT_RESET', targetType: 'provider_capability_health', targetId: before.id, reason: input.reason, requestId: input.requestId, beforeState: { state: before.circuitState, consecutiveFailures: before.consecutiveFailures }, afterState: { state: updated.circuitState, consecutiveFailures: updated.consecutiveFailures } });
      return healthView(updated);
    });
  }

  async verifyEquivalence(input: { offerId: string; canonicalProductId: string; actorUserId: string; evidence: Prisma.InputJsonValue; reason: string; requestId?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const offer = await tx.billProviderOffer.findUnique({ where: { id: input.offerId }, include: { product: true } });
      const target = await tx.billProduct.findUnique({ where: { id: input.canonicalProductId }, include: { offers: true } });
      if (!offer || !target) throw new NotFoundException({ code: 'BILL_OFFER_OR_PRODUCT_NOT_FOUND' });
      if (offer.productId === target.id) throw new ConflictException({ code: 'OFFER_ALREADY_ON_CANONICAL_PRODUCT' });
      if (!mappingCompatible(offer.product, target)) throw new ConflictException({ code: 'SKU_EQUIVALENCE_REQUIRES_EXACT_PRODUCT_SEMANTICS' });
      if (target.offers.some((existing) => existing.providerCode === offer.providerCode)) throw new ConflictException({ code: 'CANONICAL_PRODUCT_ALREADY_HAS_PROVIDER_OFFER' });
      const verification = await tx.billOfferEquivalenceVerification.create({ data: { providerOfferId: offer.id, previousProductId: offer.productId, canonicalProductId: target.id, verifiedByUserId: input.actorUserId, evidence: input.evidence } });
      const updated = await tx.billProviderOffer.update({ where: { id: offer.id }, data: { productId: target.id } });
      await this.audit.recordWithTx(tx, { actorUserId: input.actorUserId, action: 'BILL_OFFER_EQUIVALENCE_VERIFIED', targetType: 'bill_provider_offer', targetId: offer.id, reason: input.reason, requestId: input.requestId, beforeState: { productId: offer.productId, productCode: offer.product.code }, afterState: { productId: target.id, productCode: target.code, verificationId: verification.id } });
      return offerView(updated);
    });
  }
}
