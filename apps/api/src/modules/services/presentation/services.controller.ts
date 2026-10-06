import { BadRequestException, Body, Controller, ForbiddenException, Get, Headers, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import type { BillCategory } from '@twipay/contracts';
import { ZodValidationPipe } from '../../../platform/http/zod-validation.pipe.js';
import { SessionAuthGuard, requirePrincipal, type AuthenticatedFastifyRequest } from '../../auth/presentation/session-auth.guard.js';
import { BillCatalogService } from '../application/catalog.service.js';
import { BillService } from '../application/bill.service.js';

const CategorySchema = z.enum(['AIRTIME', 'DATA', 'ELECTRICITY', 'CABLE']);
const ValidateSchema = z.object({ productCode: z.string().trim().min(3).max(120), customerIdentifier: z.string().trim().min(3).max(64) }).strict();
const PurchaseSchema = z.object({
  productCode: z.string().trim().min(3).max(120),
  customerIdentifier: z.string().trim().min(3).max(64),
  amountMinor: z.string().regex(/^[1-9]\d{0,17}$/),
  validationId: z.uuid().optional(),
  contactPhoneE164: z.string().regex(/^\+[1-9]\d{7,14}$/).optional(),
}).strict();

function requireIdempotencyKey(value: string | undefined): string {
  if (!value) throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  return value;
}
function requireOperationsRole(req: AuthenticatedFastifyRequest): void {
  const principal = requirePrincipal(req);
  if (!principal.roles.some((role) => ['SUPER_ADMIN', 'OPERATIONS', 'OPERATIONS_AGENT'].includes(role))) {
    throw new ForbiddenException({ code: 'OPERATIONS_ROLE_REQUIRED' });
  }
}

@ApiTags('services')
@UseGuards(SessionAuthGuard)
@Controller('services')
export class ServicesController {
  constructor(private readonly catalog: BillCatalogService, private readonly bills: BillService) {}

  @Get('products')
  async products(@Query('category') categoryValue?: string) {
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

  @Post('validations')
  async validate(@Body(new ZodValidationPipe(ValidateSchema)) body: z.infer<typeof ValidateSchema>, @Req() req: AuthenticatedFastifyRequest) {
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
    const principal = requirePrincipal(req);
    const result = await this.bills.purchase({
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

  @Get('purchases/:reference')
  async purchaseByReference(@Param('reference') reference: string, @Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    return { purchase: await this.bills.getForUser(principal.userId, reference) };
  }

  @Post('catalog/sync/:provider/:category')
  async sync(@Param('provider') provider: string, @Param('category') category: string, @Req() req: AuthenticatedFastifyRequest) {
    requireOperationsRole(req);
    if (provider !== 'vtpass' && provider !== 'monnify') throw new BadRequestException({ code: 'BILL_PROVIDER_NOT_ENABLED' });
    const parsed = CategorySchema.safeParse(category);
    if (!parsed.success) throw new BadRequestException({ code: 'INVALID_BILL_CATEGORY' });
    return this.catalog.syncProviderCategory(provider, parsed.data);
  }
}
