import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { BillCategory } from '@twipay/contracts';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { BillProviderRegistry, type EnabledBillProvider } from '../../providers/bill-provider.registry.js';

function productCode(providerCode: string, category: string, biller: string, product: string): string {
  const digest = createHash('sha256').update(`${providerCode}|${category}|${biller}|${product}`).digest('hex').slice(0, 20);
  return `${category.toLowerCase()}-${providerCode}-${digest}`;
}

@Injectable()
export class BillCatalogService {
  constructor(private readonly prisma: PrismaService, private readonly providers: BillProviderRegistry) {}

  async syncProviderCategory(providerCode: EnabledBillProvider, category: BillCategory): Promise<{ synced: number }> {
    const descriptors = await this.providers.get(providerCode).listProducts({ category });
    let synced = 0;
    const seenOfferIds: string[] = [];
    for (const descriptor of descriptors) {
      if (descriptor.providerCode !== providerCode) throw new Error('BILL_PROVIDER_DESCRIPTOR_CODE_MISMATCH');
      const existingOffer = await this.prisma.billProviderOffer.findUnique({
        where: {
          providerCode_providerProductCode_providerBillerCode: {
            providerCode,
            providerProductCode: descriptor.providerProductCode,
            providerBillerCode: descriptor.providerBillerCode,
          },
        },
        include: { product: true },
      });
      if (existingOffer) {
        await this.prisma.$transaction([
          this.prisma.billProduct.update({
            where: { id: existingOffer.productId },
            data: {
              name: descriptor.name,
              customerIdentifierType: descriptor.customerIdentifierType,
              currency: descriptor.currency,
              fixedAmountMinor: descriptor.fixedAmountMinor ?? null,
              minAmountMinor: descriptor.minAmountMinor ?? null,
              maxAmountMinor: descriptor.maxAmountMinor ?? null,
              status: 'ACTIVE',
              metadata: descriptor.metadata ?? undefined,
            },
          }),
          this.prisma.billProviderOffer.update({
            where: { id: existingOffer.id },
            data: {
              active: true,
              requiresValidation: descriptor.requiresCustomerValidation,
              metadata: descriptor.metadata ?? undefined,
              lastSyncedAt: new Date(),
            },
          }),
        ]);
        seenOfferIds.push(existingOffer.id);
        synced += 1;
        continue;
      }

      // Automatic cross-provider SKU equivalence is deliberately forbidden.
      // A provider-specific canonical product is created here; an operator may
      // later attach a verified equivalent provider offer to the same product.
      const code = productCode(providerCode, category, descriptor.providerBillerCode, descriptor.providerProductCode);
      const createdProduct = await this.prisma.billProduct.create({
        data: {
          code,
          category,
          name: descriptor.name,
          customerIdentifierType: descriptor.customerIdentifierType,
          currency: descriptor.currency,
          fixedAmountMinor: descriptor.fixedAmountMinor ?? null,
          minAmountMinor: descriptor.minAmountMinor ?? null,
          maxAmountMinor: descriptor.maxAmountMinor ?? null,
          metadata: descriptor.metadata ?? undefined,
          offers: {
            create: {
              providerCode,
              providerProductCode: descriptor.providerProductCode,
              providerBillerCode: descriptor.providerBillerCode,
              requiresValidation: descriptor.requiresCustomerValidation,
              metadata: descriptor.metadata ?? undefined,
            },
          },
        },
        include: { offers: true },
      });
      seenOfferIds.push(createdProduct.offers[0]!.id);
      synced += 1;
    }
    await this.prisma.billProviderOffer.updateMany({
      where: { providerCode, product: { category }, ...(seenOfferIds.length ? { id: { notIn: seenOfferIds } } : {}) },
      data: { active: false },
    });
    return { synced };
  }

  async list(category?: BillCategory) {
    return this.prisma.billProduct.findMany({
      where: { status: 'ACTIVE', offers: { some: { active: true } }, ...(category ? { category } : {}) },
      include: { offers: { where: { active: true }, select: { providerCode: true } } },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }
}
