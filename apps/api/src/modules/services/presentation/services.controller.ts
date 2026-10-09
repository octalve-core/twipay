import { BadRequestException, ForbiddenException, Body, Controller, Get, Headers, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import type { BillCategory } from '@twipay/contracts';
import { ZodValidationPipe } from '../../../platform/http/zod-validation.pipe.js';
import { SessionAuthGuard, requirePrincipal, type AuthenticatedFastifyRequest } from '../../auth/presentation/session-auth.guard.js';
import { PermissionGuard, RequirePermissions } from '../../auth/presentation/permission.guard.js';
import { BillCatalogService } from '../application/catalog.service.js';
import { BillService } from '../application/bill.service.js';
import { FinancialAuthorizationService } from '../../finance/application/financial-authorization.service.js';
import { ProductConfigService } from '../../product/application/product-config.service.js';

const CategorySchema = z.enum(['AIRTIME', 'DATA', 'ELECTRICITY', 'CABLE']);
const ValidateSchema = z.object({ productCode: z.string().trim().min(3).max(120), customerIdentifier: z.string().trim().min(3).max(64) }).strict();
const PurchaseSchema = z.object({
  productCode: z.string().trim().min(3).max(120),
  customerIdentifier: z.string().trim().min(3).max(64),
  amountMinor: z.string().regex(/^[1-9]\d{0,17}$/).refine((value) => BigInt(value) <= BigInt(Number.MAX_SAFE_INTEGER), 'amount exceeds provider-safe integer range'),
  validationId: z.uuid().optional(),
  contactPhoneE164: z.string().regex(/^\+[1-9]\d{7,14}$/).optional(),
  transactionPin: z.string().regex(/^\d{4}$/),
}).strict();

function requireIdempotencyKey(value: string | undefined): string {
  if (!value) throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  return value;
}

@ApiTags('services')
@UseGuards(SessionAuthGuard)
@Controller('services')
export class ServicesController {
  constructor(private readonly catalog: BillCatalogService, private readonly bills: BillService, private readonly product: ProductConfigService, private readonly financialAuthorization: FinancialAuthorizationService) {}

  @Get('products')
  async products(@Query('category') categoryValue?: string) {
    await this.product.assertFeatureEnabled('services.utilities', true);
    const parsed = categoryValue ? CategorySchema.safeParse(categoryValue) : undefined;
    if (parsed && !parsed.success) throw new BadRequestException({ code: 'INVALID_BILL_CATEGORY' });
    const products = await this.catalog.list(parsed?.data as BillCategory | undefined);
    return {
      products: products.map((product) => ({
        code: product.code,
        category: product.category,
        name: product.name,
        customerIdentifierType: product.customerIdentifierType,
        currency: product.currency,
        fixedAmountMinor: product.fixedAmountMinor?.toString() ?? null,
        minAmountMinor: product.minAmountMinor?.toString() ?? null,
        maxAmountMinor: product.maxAmountMinor?.toString() ?? null,
      })),
    };
  }

  private assertSandboxPurchasesEnabled(): void {
    if (process.env['NODE_ENV'] === 'production' || process.env['BILL_PURCHASES_SANDBOX_ENABLED'] !== 'true') {
      throw new ForbiddenException({ code: 'BILL_PURCHASES_NOT_QUALIFIED' });
    }
    // A developer enabling the sandbox flag cannot accidentally vend through live
    // provider endpoints by supplying a production base URL.
    for (const [variable, hostname] of [
      ['VTPASS_BASE_URL', 'sandbox.vtpass.com'],
      ['MONNIFY_BASE_URL', 'sandbox.monnify.com'],
    ] as const) {
      const configured = process.env[variable] ?? `https://${hostname}`;
      let parsed: URL;
      try { parsed = new URL(configured); }
      catch { throw new ForbiddenException({ code: 'BILL_PROVIDER_SANDBOX_REQUIRED' }); }
      if (parsed.protocol !== 'https:' || parsed.hostname !== hostname || parsed.port
          || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
        throw new ForbiddenException({ code: 'BILL_PROVIDER_SANDBOX_REQUIRED' });
      }
    }
  }

  @Post('validations')
  async validate(@Body(new ZodValidationPipe(ValidateSchema)) body: z.infer<typeof ValidateSchema>, @Req() req: AuthenticatedFastifyRequest) {
    await this.product.assertFeatureEnabled('services.utilities', true);
    this.assertSandboxPurchasesEnabled();
    const principal = requirePrincipal(req);
    const result = await this.bills.validateCustomer({ userId: principal.userId, productCode: body.productCode, customerIdentifier: body.customerIdentifier });
    return { validation: result };
  }

  @Post('purchases')
  async purchase(
    @Body(new ZodValidationPipe(PurchaseSchema)) body: z.infer<typeof PurchaseSchema>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: AuthenticatedFastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    await this.product.assertFeatureEnabled('services.utilities', true);
    this.assertSandboxPurchasesEnabled();
    const principal = requirePrincipal(req);
    const authorization = await this.financialAuthorization.authorize({ principal, transactionPin: body.transactionPin, amountMinor: BigInt(body.amountMinor), intent: 'BILL_PAYMENT' });
    const result = await this.bills.purchase({
      authorization,
      userId: principal.userId,
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      productCode: body.productCode,
      customerIdentifier: body.customerIdentifier,
      amountMinor: BigInt(body.amountMinor),
      ...(body.validationId ? { validationId: body.validationId } : {}),
      ...(body.contactPhoneE164 ? { contactPhoneE164: body.contactPhoneE164 } : {}),
    });
    res.status(result.statusCode);
    return result.body;
  }


  @Get('purchases')
  async purchases(@Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    return { purchases: await this.bills.listForUser(principal.userId) };
  }

  @Get('purchases/:reference')
  async purchaseByReference(@Param('reference') reference: string, @Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    return { purchase: await this.bills.getForUser(principal.userId, reference) };
  }

  @Post('catalog/sync/:provider/:category')
  @UseGuards(PermissionGuard)
  @RequirePermissions('ops.providers.manage')
  async sync(@Param('provider') provider: string, @Param('category') category: string, @Req() req: AuthenticatedFastifyRequest) {
    requirePrincipal(req);
    if (provider !== 'vtpass' && provider !== 'monnify') throw new BadRequestException({ code: 'BILL_PROVIDER_NOT_ENABLED' });
    const parsed = CategorySchema.safeParse(category);
    if (!parsed.success) throw new BadRequestException({ code: 'INVALID_BILL_CATEGORY' });
    return this.catalog.syncProviderCategory(provider, parsed.data);
  }
}
