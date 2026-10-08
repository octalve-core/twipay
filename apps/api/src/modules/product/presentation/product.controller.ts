import { Body, Controller, ForbiddenException, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../platform/http/zod-validation.pipe.js';
import { PermissionGuard, RequirePermissions, requireMfa } from '../../auth/presentation/permission.guard.js';
import { SessionAuthGuard, requirePrincipal, type AuthenticatedFastifyRequest } from '../../auth/presentation/session-auth.guard.js';
import { ProductConfigService } from '../application/product-config.service.js';

const FlagSchema = z.object({ key: z.string().min(3).max(120).regex(/^[a-z][a-z0-9_.-]{2,119}$/), enabled: z.boolean(), public: z.boolean(), description: z.string().max(500).optional(), config: z.record(z.string(), z.unknown()).optional(), reason: z.string().trim().min(5).max(500) }).strict();
const BrandSchema = z.object({
  reason: z.string().trim().min(5).max(500),
  productName: z.string().trim().min(2).max(120), legalName: z.string().trim().min(2).max(180), domain: z.string().trim().min(3).max(255),
  supportEmail: z.email().max(320), logoUrl: z.url().max(1000).nullable().optional(), primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/), privacyUrl: z.url().max(1000).nullable().optional(), termsUrl: z.url().max(1000).nullable().optional(),
}).strict();
const DeploymentSchema = z.object({ productSlug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), edition: z.enum(['TWIPAY_OWNED','WHITE_LABEL','ENTERPRISE_SOURCE']), licensedTo: z.string().trim().min(2).max(180), status: z.enum(['ACTIVE','SUSPENDED','EXPIRED']), allowedModules: z.array(z.string().trim().min(2).max(80)).min(1).max(50), supportMode: z.enum(['SELF_MANAGED','OCTALVE_MANAGED','ENTERPRISE_SUPPORT']), licenseReference: z.string().trim().max(160).nullable().optional(), validUntil: z.string().datetime().nullable().optional(), reason: z.string().trim().min(5).max(500) }).strict();

@ApiTags('product')
@Controller('product')
export class ProductController {
  constructor(private readonly product: ProductConfigService) {}

  @Get('config')
  async config() { return this.product.publicConfig(); }

  @Get('admin/flags')
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermissions('ops.feature_flags.manage')
  async flags() { return { flags: await this.product.listFlags() }; }

  @Patch('admin/flags')
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermissions('ops.feature_flags.manage')
  async updateFlag(@Body(new ZodValidationPipe(FlagSchema)) body: z.infer<typeof FlagSchema>, @Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    if (body.enabled && ['events.refunds', 'operations.organizer_payouts'].includes(body.key)) {
      if (process.env['HIGH_RISK_FEATURES_RELEASE_QUALIFIED'] !== 'true') {
        throw new ForbiddenException({ code: 'RELEASE_QUALIFICATION_REQUIRED' });
      }
      requireMfa(req);
    }
    const { reason, ...flag } = body;
    return { flag: await this.product.upsertFlag({ ...flag, actorUserId: principal.userId, reason, requestId: req.id }) };
  }

  @Patch('admin/brand')
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermissions('ops.branding.manage')
  async updateBrand(@Body(new ZodValidationPipe(BrandSchema)) body: z.infer<typeof BrandSchema>, @Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    const { reason, ...brand } = body;
    return { brand: await this.product.updateBrand({ ...brand, actorUserId: principal.userId, reason, requestId: req.id }) };
  }

  @Get('admin/deployment')
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermissions('ops.branding.manage')
  async deployment() { return { deployment: await this.product.deploymentProfile() }; }

  @Patch('admin/deployment')
  @UseGuards(SessionAuthGuard, PermissionGuard)
  @RequirePermissions('ops.branding.manage')
  async updateDeployment(@Body(new ZodValidationPipe(DeploymentSchema)) body: z.infer<typeof DeploymentSchema>, @Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    return { deployment: await this.product.updateDeployment({ ...body, allowedModules: body.allowedModules, validUntil: body.validUntil ? new Date(body.validUntil) : null, actorUserId: principal.userId, requestId: req.id }) };
  }

}
