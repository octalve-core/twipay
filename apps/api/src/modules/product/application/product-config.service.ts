import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { assertFeatureKey, assertHexColor } from '@twipay/operations';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../platform/database/prisma.service.js';

@Injectable()
export class ProductConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async assertFeatureEnabled(key: string, defaultEnabled = false): Promise<void> {
    assertFeatureKey(key);
    const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
    if (!(flag?.enabled ?? defaultEnabled)) throw new ServiceUnavailableException({ code: 'FEATURE_DISABLED', feature: key });
  }

  async publicConfig() {
    const [brand, flags] = await Promise.all([
      this.prisma.brandConfiguration.findUnique({ where: { key: 'default' } }),
      this.prisma.featureFlag.findMany({ where: { public: true }, orderBy: { key: 'asc' } }),
    ]);
    return {
      brand: brand ?? {
        key: 'default', productName: 'TwiPay', legalName: 'Octalve Ltd', domain: 'twipay.co', supportEmail: 'support@twipay.co',
        logoUrl: null, primaryColor: '#5B2A86', accentColor: '#C59A35', privacyUrl: null, termsUrl: null, metadata: null,
      },
      features: Object.fromEntries(flags.map((flag) => [flag.key, { enabled: flag.enabled, config: flag.config ?? null }])),
    };
  }

  async listFlags() { return this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } }); }

  async upsertFlag(input: { key: string; enabled: boolean; public: boolean; description?: string; config?: Prisma.InputJsonValue; actorUserId: string; reason: string; requestId?: string }) {
    assertFeatureKey(input.key);
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.featureFlag.findUnique({ where: { key: input.key } });
      const flag = await tx.featureFlag.upsert({
        where: { key: input.key },
        create: { key: input.key, enabled: input.enabled, public: input.public, description: input.description, config: input.config, updatedByUserId: input.actorUserId },
        update: { enabled: input.enabled, public: input.public, description: input.description, config: input.config, updatedByUserId: input.actorUserId },
      });
      await tx.operationalAuditEvent.create({ data: { actorUserId: input.actorUserId, action: 'FEATURE_FLAG_UPDATED', targetType: 'feature_flag', targetId: input.key, beforeState: before ? { enabled: before.enabled, public: before.public } : undefined, afterState: { enabled: flag.enabled, public: flag.public }, reason: input.reason, requestId: input.requestId } });
      return flag;
    });
  }

  async updateBrand(input: {
    productName: string; legalName: string; domain: string; supportEmail: string; logoUrl?: string | null;
    primaryColor: string; accentColor: string; privacyUrl?: string | null; termsUrl?: string | null; actorUserId: string; reason: string; requestId?: string;
  }) {
    assertHexColor(input.primaryColor); assertHexColor(input.accentColor);
    const { actorUserId, reason, requestId, ...brandData } = input;
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.brandConfiguration.findUnique({ where: { key: 'default' } });
      const brand = await tx.brandConfiguration.upsert({
        where: { key: 'default' },
        create: { key: 'default', ...brandData, updatedByUserId: actorUserId },
        update: { ...brandData, updatedByUserId: actorUserId },
      });
      await tx.operationalAuditEvent.create({ data: { actorUserId, action: 'BRAND_CONFIGURATION_UPDATED', targetType: 'brand_configuration', targetId: 'default', beforeState: before ? { productName: before.productName, domain: before.domain, primaryColor: before.primaryColor, accentColor: before.accentColor } : undefined, afterState: { productName: brand.productName, domain: brand.domain, primaryColor: brand.primaryColor, accentColor: brand.accentColor }, reason, requestId } });
      return brand;
    });
  }

  async deploymentProfile() {
    return this.prisma.deploymentProfile.findUnique({ where: { key: 'default' } });
  }

  async updateDeployment(input: {
    productSlug: string; edition: 'TWIPAY_OWNED'|'WHITE_LABEL'|'ENTERPRISE_SOURCE'; licensedTo: string; status: 'ACTIVE'|'SUSPENDED'|'EXPIRED';
    allowedModules?: Prisma.InputJsonValue; supportMode: 'SELF_MANAGED'|'OCTALVE_MANAGED'|'ENTERPRISE_SUPPORT'; licenseReference?: string|null; validUntil?: Date|null;
    actorUserId: string; reason: string; requestId?: string;
  }) {
    const { actorUserId, reason, requestId, ...profileData } = input;
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.deploymentProfile.findUnique({ where: { key: 'default' } });
      const profile = await tx.deploymentProfile.upsert({
        where: { key: 'default' },
        create: { key: 'default', ...profileData, updatedByUserId: actorUserId },
        update: { ...profileData, updatedByUserId: actorUserId },
      });
      await tx.operationalAuditEvent.create({ data: { actorUserId, action: 'DEPLOYMENT_PROFILE_UPDATED', targetType: 'deployment_profile', targetId: 'default', reason, requestId, beforeState: before ? { edition: before.edition, licensedTo: before.licensedTo, status: before.status, supportMode: before.supportMode } : undefined, afterState: { edition: profile.edition, licensedTo: profile.licensedTo, status: profile.status, supportMode: profile.supportMode } } });
      return profile;
    });
  }

}
