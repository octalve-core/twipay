import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../platform/http/zod-validation.pipe.js';
import {
  SessionAuthGuard,
  requirePrincipal,
  type AuthenticatedFastifyRequest,
} from '../../auth/presentation/session-auth.guard.js';
import { PaymentService } from '../application/payment.service.js';
import { TransferService } from '../application/transfer.service.js';
import { VirtualAccountService } from '../application/virtual-account.service.js';
import { WalletService } from '../application/wallet.service.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';

const MAX_PROVIDER_SAFE_MINOR = BigInt(Number.MAX_SAFE_INTEGER);
const MinorAmountSchema = z.string()
  .regex(/^[1-9]\d*$/)
  .max(16)
  .refine((value) => BigInt(value) <= MAX_PROVIDER_SAFE_MINOR, 'amount exceeds the provider-safe integer range');
const ProviderSchema = z.enum(['paystack', 'monnify']);
const CollectionSchema = z.object({ provider: ProviderSchema, amountMinor: MinorAmountSchema, currency: z.literal('NGN') }).strict();
const ResolveAccountSchema = z.object({ provider: ProviderSchema, bankCode: z.string().trim().min(2).max(20), accountNumber: z.string().regex(/^\d{10}$/), currency: z.literal('NGN') }).strict();
const TransferSchema = z.object({
  provider: ProviderSchema,
  amountMinor: MinorAmountSchema,
  currency: z.literal('NGN'),
  bankCode: z.string().trim().min(2).max(20),
  accountNumber: z.string().regex(/^\d{10}$/),
  narration: z.string().trim().min(3).max(120),
}).strict();
const VirtualAccountSchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('paystack'),
    consent: z.literal(true),
    preferredBank: z.string().trim().min(2).max(80).optional(),
    validationBankCode: z.string().trim().min(2).max(20),
    validationAccountNumber: z.string().regex(/^\d{10}$/),
  }).strict(),
  z.object({
    provider: z.literal('monnify'),
    consent: z.literal(true),
    preferredBank: z.string().trim().min(2).max(80).optional(),
  }).strict(),
]);

function maskAccountNumber(accountNumber: string): string {
  return accountNumber.length <= 4 ? accountNumber : `${'*'.repeat(accountNumber.length - 4)}${accountNumber.slice(-4)}`;
}

function requireIdempotencyKey(value: string | undefined): string {
  if (!value) throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  return value;
}

@ApiTags('financial-core')
@UseGuards(SessionAuthGuard)
@Controller()
export class FinanceController {
  constructor(
    private readonly wallets: WalletService,
    private readonly payments: PaymentService,
    private readonly transfers: TransferService,
    private readonly virtualAccounts: VirtualAccountService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('wallets')
  async wallet(@Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    const summary = await this.wallets.getSummary(principal.userId, 'NGN');
    return {
      wallet: {
        id: summary.id,
        currency: summary.currency,
        status: summary.status,
        postedBalanceMinor: summary.postedBalanceMinor.toString(),
        activeHoldsMinor: summary.activeHoldsMinor.toString(),
        availableBalanceMinor: summary.availableBalanceMinor.toString(),
      },
    };
  }

  @Post('payments/collections')
  async createCollection(
    @Body(new ZodValidationPipe(CollectionSchema)) body: z.infer<typeof CollectionSchema>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: AuthenticatedFastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const principal = requirePrincipal(req);
    const result = await this.payments.createCollection({
      userId: principal.userId,
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      providerCode: body.provider,
      amountMinor: BigInt(body.amountMinor),
      currency: body.currency,
    });
    res.status(result.statusCode);
    return result.body;
  }

  @Post('transfers/resolve-account')
  async resolveAccount(
    @Body(new ZodValidationPipe(ResolveAccountSchema)) body: z.infer<typeof ResolveAccountSchema>,
    @Req() req: AuthenticatedFastifyRequest,
  ) {
    requirePrincipal(req);
    const result = await this.transfers.resolveBankAccount({
      providerCode: body.provider,
      bankCode: body.bankCode,
      accountNumber: body.accountNumber,
      currency: body.currency,
    });
    return {
      account: {
        providerCode: result.providerCode,
        bankCode: result.bankCode,
        accountNumber: maskAccountNumber(result.accountNumber),
        accountName: result.accountName,
        ...(result.bankName ? { bankName: result.bankName } : {}),
        currency: result.currency,
      },
    };
  }

  @Post('transfers')
  async transfer(
    @Body(new ZodValidationPipe(TransferSchema)) body: z.infer<typeof TransferSchema>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: AuthenticatedFastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const principal = requirePrincipal(req);
    const result = await this.transfers.createTransfer({
      userId: principal.userId,
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      providerCode: body.provider,
      amountMinor: BigInt(body.amountMinor),
      currency: body.currency,
      bankCode: body.bankCode,
      accountNumber: body.accountNumber,
      narration: body.narration,
    });
    res.status(result.statusCode);
    return result.body;
  }

  @Get('virtual-accounts')
  async virtualAccountsForUser(@Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    return { virtualAccounts: await this.virtualAccounts.listForUser(principal.userId) };
  }

  @Post('virtual-accounts')
  async virtualAccount(
    @Body(new ZodValidationPipe(VirtualAccountSchema)) body: z.infer<typeof VirtualAccountSchema>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: AuthenticatedFastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const principal = requirePrincipal(req);
    const result = await this.virtualAccounts.create({
      userId: principal.userId,
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      providerCode: body.provider,
      consent: true,
      ...(body.preferredBank ? { preferredBank: body.preferredBank } : {}),
      ...(body.provider === 'paystack' ? {
        validationBankCode: body.validationBankCode,
        validationAccountNumber: body.validationAccountNumber,
      } : {}),
    });
    res.status(result.statusCode);
    return result.body;
  }


  @Get('transactions')
  async transactions(@Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    const transactions = await this.prisma.financialTransaction.findMany({
      where: { userId: principal.userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { providerOps: { select: { providerCode: true }, take: 1 } },
    });
    return { transactions: transactions.map((transaction) => ({
      reference: transaction.reference, type: transaction.type, status: transaction.status, currency: transaction.currency,
      amountMinor: transaction.amountMinor.toString(), feeMinor: transaction.feeMinor.toString(), description: transaction.description,
      provider: transaction.providerOps[0]?.providerCode ?? null, createdAt: transaction.createdAt, updatedAt: transaction.updatedAt,
    })) };
  }

  @Get('transactions/:reference')
  async transaction(@Param('reference') reference: string, @Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    const transaction = await this.prisma.financialTransaction.findFirst({
      where: { reference, userId: principal.userId },
      include: { providerOps: true, bankTransfer: { include: { beneficiary: true } } },
    });
    if (!transaction) return { transaction: null };
    return {
      transaction: {
        reference: transaction.reference,
        type: transaction.type,
        status: transaction.status,
        currency: transaction.currency,
        amountMinor: transaction.amountMinor.toString(),
        feeMinor: transaction.feeMinor.toString(),
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
        provider: transaction.providerOps[0]?.providerCode ?? null,
        beneficiary: transaction.bankTransfer ? {
          bankCode: transaction.bankTransfer.beneficiary.bankCode,
          accountNumber: `******${transaction.bankTransfer.beneficiary.accountNumberLast4}`,
          accountName: transaction.bankTransfer.beneficiary.accountName,
        } : null,
      },
    };
  }
}
