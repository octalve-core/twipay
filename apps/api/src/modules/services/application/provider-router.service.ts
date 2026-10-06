import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { chooseRoute, circuitAfterOutcome, type RouteCandidate } from '@twipay/services';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import type { EnabledBillProvider } from '../../providers/bill-provider.registry.js';

@Injectable()
export class BillProviderRouterService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(productId: string): Promise<{ offerId: string; providerCode: EnabledBillProvider }> {
    const offers = await this.prisma.billProviderOffer.findMany({
      where: { productId, active: true },
      include: { product: true },
    });
    if (offers.length === 0) throw new ServiceUnavailableException({ code: 'BILL_PRODUCT_NO_ACTIVE_PROVIDER' });

    const healthRows = await this.prisma.providerCapabilityHealth.findMany({
      where: { capability: `BILL:${offers[0]!.product.category}`, providerCode: { in: offers.map((offer) => offer.providerCode) } },
    });
    const health = new Map(healthRows.map((row) => [row.providerCode, row]));
    const candidates: RouteCandidate[] = offers.map((offer) => {
      const state = health.get(offer.providerCode);
      return {
        providerCode: offer.providerCode,
        providerOfferId: offer.id,
        category: offer.product.category,
        currency: offer.product.currency as 'NGN',
        active: offer.active,
        priority: offer.priority,
        ...(offer.estimatedCostMinor !== null ? { estimatedCostMinor: offer.estimatedCostMinor } : {}),
        ...(state?.successRateBps !== null && state?.successRateBps !== undefined ? { successRateBps: state.successRateBps } : {}),
        ...(state?.p95LatencyMs !== null && state?.p95LatencyMs !== undefined ? { p95LatencyMs: state.p95LatencyMs } : state?.lastLatencyMs !== null && state?.lastLatencyMs !== undefined ? { p95LatencyMs: state.lastLatencyMs } : {}),
        circuitState: state?.circuitState ?? 'CLOSED',
        ...(state?.cooldownUntil ? { cooldownUntil: state.cooldownUntil } : {}),
      };
    });
    const decision = chooseRoute(candidates);
    if (!decision) throw new ServiceUnavailableException({ code: 'BILL_PROVIDER_TEMPORARILY_UNAVAILABLE' });
    if (decision.providerCode !== 'vtpass' && decision.providerCode !== 'monnify') {
      throw new ServiceUnavailableException({ code: 'BILL_PROVIDER_NOT_ENABLED' });
    }

    const current = health.get(decision.providerCode);
    if (current?.circuitState === 'OPEN' && current.cooldownUntil && current.cooldownUntil <= new Date()) {
      await this.prisma.providerCapabilityHealth.update({ where: { id: current.id }, data: { circuitState: 'HALF_OPEN' } });
    }
    return { offerId: decision.providerOfferId, providerCode: decision.providerCode };
  }

  async recordOutcome(input: {
    providerCode: EnabledBillProvider;
    category: string;
    outcome: 'SUCCESS' | 'DETERMINISTIC_FAILURE' | 'TRANSIENT_FAILURE';
    latencyMs?: number;
  }): Promise<void> {
    const capability = `BILL:${input.category}`;
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.providerCapabilityHealth.upsert({
        where: { providerCode_capability: { providerCode: input.providerCode, capability } },
        create: { providerCode: input.providerCode, capability },
        update: {},
      });
      const next = circuitAfterOutcome({
        state: row.circuitState,
        consecutiveFailures: row.consecutiveFailures,
        ...(row.openedAt ? { openedAt: row.openedAt } : {}),
        ...(row.cooldownUntil ? { cooldownUntil: row.cooldownUntil } : {}),
      }, input.outcome);
      const successCount = row.successCount + (input.outcome === 'SUCCESS' ? 1n : 0n);
      const failureCount = row.failureCount + (input.outcome === 'TRANSIENT_FAILURE' ? 1n : 0n);
      const observed = successCount + failureCount;
      const successRateBps = observed > 0n ? Number((successCount * 10_000n) / observed) : null;
      await tx.providerCapabilityHealth.update({
        where: { id: row.id },
        data: {
          circuitState: next.state,
          consecutiveFailures: next.consecutiveFailures,
          openedAt: next.openedAt ?? null,
          cooldownUntil: next.cooldownUntil ?? null,
          successCount,
          failureCount,
          successRateBps,
          ...(input.latencyMs !== undefined ? { lastLatencyMs: Math.max(0, Math.round(input.latencyMs)) } : {}),
          ...(input.outcome === 'SUCCESS' ? { lastSuccessAt: new Date() } : {}),
          ...(input.outcome === 'TRANSIENT_FAILURE' ? { lastFailureAt: new Date() } : {}),
        },
      });
    });
  }
}
