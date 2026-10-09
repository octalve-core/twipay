import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  ServiceUnavailableException,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import type { FinancialTransactionStatus, Prisma } from '@prisma/client';
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
import { FinancialAuthorizationService } from '../application/financial-authorization.service.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';

const MAX_PROVIDER_SAFE_MINOR = BigInt(Number.MAX_SAFE_INTEGER);
const MinorAmountSchema = z.string()
  .regex(/^[1-9]\d*$/)
  .max(16)
  .refine((value) => BigInt(value) <= MAX_PROVIDER_SAFE_MINOR, 'amount exceeds the provider-safe integer range');
const ProviderSchema = z.enum(['paystack', 'monnify']);
const FinancialPinSchema = z.string().regex(/^\d{4}$/);
const CollectionSchema = z.object({ provider: ProviderSchema, amountMinor: MinorAmountSchema, currency: z.literal('NGN'), transactionPin: FinancialPinSchema }).strict();
const ResolveAccountSchema = z.object({ provider: ProviderSchema, bankCode: z.string().trim().min(2).max(20), accountNumber: z.string().regex(/^\d{10}$/), currency: z.literal('NGN') }).strict();
const TransferQuoteSchema = z.object({
  provider: ProviderSchema, amountMinor: MinorAmountSchema, currency: z.literal('NGN'),
  bankCode: z.string().regex(/^[A-Za-z0-9_-]{2,20}$/), accountNumber: z.string().regex(/^\d{10}$/),
  narration: z.string().trim().min(3).max(120),
}).strict();
const SavedTransferQuoteSchema = z.object({ amountMinor: MinorAmountSchema, currency: z.literal('NGN'),
  narration: z.string().trim().min(3).max(120) }).strict();
const SavedTransferSchema = SavedTransferQuoteSchema.extend({ expectedAccountName: z.string().trim().min(2).max(160),
  quoteToken: z.string().min(80).max(3000), transactionPin: FinancialPinSchema }).strict();
const SaveBeneficiarySchema = z.object({
  provider: ProviderSchema, bankCode: z.string().regex(/^[A-Za-z0-9_-]{2,20}$/),
  accountNumber: z.string().regex(/^\d{10}$/), nickname: z.string().trim().min(1).max(60).optional(),
}).strict();
const RenameBeneficiarySchema = z.object({ nickname: z.string().trim().min(1).max(60).nullable() }).strict();
const TransferSchema = z.object({
  provider: ProviderSchema,
  amountMinor: MinorAmountSchema,
  currency: z.literal('NGN'),
  bankCode: z.string().trim().min(2).max(20),
  accountNumber: z.string().regex(/^\d{10}$/),
  narration: z.string().trim().min(3).max(120),
  expectedAccountName: z.string().trim().min(2).max(160),
  quoteToken: z.string().min(80).max(3000),
  transactionPin: FinancialPinSchema,
}).strict();
const VirtualAccountSchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('paystack'),
    consent: z.literal(true),
    transactionPin: FinancialPinSchema,
    preferredBank: z.string().trim().min(2).max(80).optional(),
    validationBankCode: z.string().trim().min(2).max(20),
    validationAccountNumber: z.string().regex(/^\d{10}$/),
  }).strict(),
  z.object({
    provider: z.literal('monnify'),
    consent: z.literal(true),
    transactionPin: FinancialPinSchema,
    preferredBank: z.string().trim().min(2).max(80).optional(),
  }).strict(),
]);

// Bounded, owner-scoped read-only transaction history. Never accept userId from query.
const TransactionTypeSchema = z.enum(['FUNDING', 'TRANSFER', 'BILL_PAYMENT', 'EVENT_PURCHASE', 'REFUND', 'REVERSAL', 'FEE', 'ADJUSTMENT', 'ORGANIZER_PAYOUT']);
const TransactionStatusSchema = z.enum(['CREATED', 'AUTHORIZED', 'FUNDS_RESERVED', 'PROVIDER_SUBMITTED', 'PROCESSING', 'UNKNOWN', 'SUCCEEDED', 'FAILED', 'REVERSED', 'CANCELLED']);
const DbMinorAmountSchema = z.string().regex(/^(0|[1-9]\d*)$/).max(19)
  .refine((value) => BigInt(value) <= 9223372036854775807n, 'Amount filter out of range');
const DateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
const HistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: z.union([TransactionStatusSchema, z.literal('PENDING'), z.literal('IN_FLIGHT')]).optional(),
  type: TransactionTypeSchema.optional(),
  startDate: DateOnlySchema.optional(),
  endDate: DateOnlySchema.optional(),
  minAmountMinor: DbMinorAmountSchema.optional(),
  maxAmountMinor: DbMinorAmountSchema.optional(),
}).strict().refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, 'Invalid date range')
  .refine((v) => !v.minAmountMinor || !v.maxAmountMinor || BigInt(v.minAmountMinor) <= BigInt(v.maxAmountMinor), 'Invalid amount range');

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
    private readonly financialAuthorization: FinancialAuthorizationService,
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
    // Fail closed: collections require explicit sandbox qualification and may never
    // be enabled on the unqualified production API via a frontend-only switch.
    if (process.env['NODE_ENV'] === 'production' || process.env['WALLET_COLLECTIONS_SANDBOX_ENABLED'] !== 'true') {
      throw new ServiceUnavailableException({ code: 'WALLET_FUNDING_NOT_RELEASE_QUALIFIED' });
    }
    if (body.provider === 'paystack' && !process.env['PAYSTACK_SECRET_KEY']?.startsWith('sk_test_')) {
      throw new ServiceUnavailableException({ code: 'PAYSTACK_SANDBOX_KEY_REQUIRED' });
    }
    if (body.provider === 'monnify' && (() => {
      try {
        const url = new URL(process.env['MONNIFY_BASE_URL'] ?? 'https://sandbox.monnify.com');
        return url.protocol !== 'https:' || url.hostname !== 'sandbox.monnify.com' || !!url.username || !!url.password;
      } catch { return true; }
    })()) {
      throw new ServiceUnavailableException({ code: 'MONNIFY_SANDBOX_REQUIRED' });
    }
    const principal = requirePrincipal(req);
    const authorization = await this.financialAuthorization.authorize({ principal, transactionPin: body.transactionPin, amountMinor: BigInt(body.amountMinor), intent: 'FUNDING' });
    const result = await this.payments.createCollection({
      authorization,
      userId: principal.userId,
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      providerCode: body.provider,
      amountMinor: BigInt(body.amountMinor),
      currency: body.currency,
    });
    res.status(result.statusCode);
    return result.body;
  }

  private assertBankTransferSandbox(provider: 'paystack' | 'monnify'): void {
    // A frontend flag must never enable real-money payouts independently.
    if (process.env['NODE_ENV'] === 'production' || process.env['BANK_TRANSFERS_SANDBOX_ENABLED'] !== 'true') {
      throw new ServiceUnavailableException({code: 'BANK_TRANSFERS_NOT_RELEASE_QUALIFIED'});
    }
    if (provider === 'paystack' && !process.env['PAYSTACK_SECRET_KEY']?.startsWith('sk_test_')) {
      throw new ServiceUnavailableException({code: 'PAYSTACK_SANDBOX_KEY_REQUIRED'});
    }
    if (provider === 'monnify') {
      try {
        const url = new URL(process.env['MONNIFY_BASE_URL'] ?? 'https://sandbox.monnify.com');
        if (url.protocol !== 'https:' || url.hostname !== 'sandbox.monnify.com' || url.username || url.password || url.port) {
          throw new Error('Invalid sandbox host');
        }
      } catch {
        throw new ServiceUnavailableException({code: 'MONNIFY_SANDBOX_REQUIRED'});
      }
    }
  }

  @Get('transfers/banks')
  async supportedBanks(@Query('provider') provider: string, @Req() req: AuthenticatedFastifyRequest) {
    requirePrincipal(req);
    if (provider !== 'paystack' && provider !== 'monnify') throw new BadRequestException({code:'INVALID_PAYMENT_PROVIDER'});
    this.assertBankTransferSandbox(provider);
    return {provider,banks:await this.transfers.listBanks(provider)};
  }

  @Post('transfers/resolve-account')
  async resolveAccount(
    @Body(new ZodValidationPipe(ResolveAccountSchema)) body: z.infer<typeof ResolveAccountSchema>,
    @Req() req: AuthenticatedFastifyRequest,
  ) {
    requirePrincipal(req);
    this.assertBankTransferSandbox(body.provider);
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

  @Get('transfers/beneficiaries')
  async beneficiaries(@Req() req: AuthenticatedFastifyRequest) {
    return { beneficiaries: await this.transfers.savedBeneficiaries(requirePrincipal(req).userId) };
  }

  @Post('transfers/beneficiaries')
  async saveBeneficiary(
    @Body(new ZodValidationPipe(SaveBeneficiarySchema)) body: z.infer<typeof SaveBeneficiarySchema>,
    @Req() req: AuthenticatedFastifyRequest,
  ) {
    const principal = requirePrincipal(req);
    this.assertBankTransferSandbox(body.provider);
    return { beneficiary: await this.transfers.saveBeneficiary({ userId: principal.userId,
      providerCode: body.provider, bankCode: body.bankCode, accountNumber: body.accountNumber,
      ...(body.nickname ? { nickname: body.nickname } : {}) }) };
  }

  @Patch('transfers/beneficiaries/:id')
  async renameBeneficiary(@Param('id') id: string,
    @Body(new ZodValidationPipe(RenameBeneficiarySchema)) body: z.infer<typeof RenameBeneficiarySchema>,
    @Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    if (!z.string().uuid().safeParse(id).success) throw new BadRequestException({ code: 'INVALID_BENEFICIARY_ID' });
    await this.transfers.renameSavedBeneficiary(principal.userId, id, body.nickname);
    return { updated: true };
  }

  @Delete('transfers/beneficiaries/:id')
  async removeBeneficiary(@Param('id') id: string, @Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    if (!z.string().uuid().safeParse(id).success) throw new BadRequestException({ code: 'INVALID_BENEFICIARY_ID' });
    await this.transfers.removeSavedBeneficiary(principal.userId, id);
    return { removed: true };
  }

  @Post('transfers/beneficiaries/:id/quote')
  async quoteSavedTransfer(@Param('id') id: string,
    @Body(new ZodValidationPipe(SavedTransferQuoteSchema)) body: z.infer<typeof SavedTransferQuoteSchema>,
    @Req() req: AuthenticatedFastifyRequest) {
    if (!z.string().uuid().safeParse(id).success) throw new BadRequestException({ code: 'INVALID_BENEFICIARY_ID' });
    const principal = requirePrincipal(req);
    const destination = await this.transfers.savedTransferDestination(principal.userId, id);
    this.assertBankTransferSandbox(destination.providerCode);
    return this.transfers.quoteSavedTransfer({ userId: principal.userId, savedBeneficiaryId: id,
      amountMinor: BigInt(body.amountMinor), narration: body.narration });
  }

  @Post('transfers/beneficiaries/:id/transfer')
  async transferSaved(@Param('id') id: string,
    @Body(new ZodValidationPipe(SavedTransferSchema)) body: z.infer<typeof SavedTransferSchema>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: AuthenticatedFastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply) {
    if (!z.string().uuid().safeParse(id).success) throw new BadRequestException({ code: 'INVALID_BENEFICIARY_ID' });
    const principal = requirePrincipal(req);
    const destination = await this.transfers.savedTransferDestination(principal.userId, id);
    this.assertBankTransferSandbox(destination.providerCode);
    const totalDebitMinor = this.transfers.validatedTransferTotal({ token: body.quoteToken,
      userId: principal.userId, ...destination, accountName: body.expectedAccountName,
      amountMinor: BigInt(body.amountMinor), narration: body.narration, savedBeneficiaryId: id });
    const authorization = await this.financialAuthorization.authorize({ principal,
      transactionPin: body.transactionPin, amountMinor: totalDebitMinor, intent: 'TRANSFER' });
    const result = await this.transfers.createTransfer({ authorization, userId: principal.userId,
      idempotencyKey: requireIdempotencyKey(idempotencyKey), ...destination,
      expectedAccountName: body.expectedAccountName, amountMinor: BigInt(body.amountMinor),
      currency: body.currency, narration: body.narration, quoteToken: body.quoteToken, savedBeneficiaryId: id });
    res.status(result.statusCode);
    return result.body;
  }

  @Post('transfers/quote')
  async quoteTransfer(
    @Body(new ZodValidationPipe(TransferQuoteSchema)) body: z.infer<typeof TransferQuoteSchema>,
    @Req() req: AuthenticatedFastifyRequest,
  ) {
    const principal = requirePrincipal(req);
    this.assertBankTransferSandbox(body.provider);
    return this.transfers.quoteTransfer({ userId: principal.userId, providerCode: body.provider,
      bankCode: body.bankCode, accountNumber: body.accountNumber, amountMinor: BigInt(body.amountMinor), narration: body.narration });
  }

  @Post('transfers')
  async transfer(
    @Body(new ZodValidationPipe(TransferSchema)) body: z.infer<typeof TransferSchema>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: AuthenticatedFastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const principal = requirePrincipal(req);
    this.assertBankTransferSandbox(body.provider);
    const totalDebitMinor = this.transfers.validatedTransferTotal({ token: body.quoteToken, userId: principal.userId,
      providerCode: body.provider, bankCode: body.bankCode, accountNumber: body.accountNumber, accountName: body.expectedAccountName,
      amountMinor: BigInt(body.amountMinor), narration: body.narration });
    const authorization = await this.financialAuthorization.authorize({ principal, transactionPin: body.transactionPin, amountMinor: totalDebitMinor, intent: 'TRANSFER' });
    const result = await this.transfers.createTransfer({
      authorization,
      userId: principal.userId,
      idempotencyKey: requireIdempotencyKey(idempotencyKey),
      providerCode: body.provider,
      amountMinor: BigInt(body.amountMinor),
      currency: body.currency,
      bankCode: body.bankCode,
      accountNumber: body.accountNumber,
      narration: body.narration, expectedAccountName: body.expectedAccountName, quoteToken: body.quoteToken,
    });
    res.status(result.statusCode);
    return result.body;
  }

  private assertVirtualAccountSandbox(provider: 'paystack' | 'monnify'): void {
    // Provisioning is a provider write. It must never be switched on by a browser-only flag.
    if (process.env['NODE_ENV'] === 'production' || process.env['VIRTUAL_ACCOUNTS_SANDBOX_ENABLED'] !== 'true') {
      throw new ServiceUnavailableException({ code: 'VIRTUAL_ACCOUNT_PROVISIONING_NOT_RELEASE_QUALIFIED' });
    }
    if (provider === 'paystack' && !process.env['PAYSTACK_SECRET_KEY']?.startsWith('sk_test_')) {
      throw new ServiceUnavailableException({ code: 'PAYSTACK_SANDBOX_KEY_REQUIRED' });
    }
    if (provider === 'monnify') {
      try {
        const url = new URL(process.env['MONNIFY_BASE_URL'] ?? 'https://sandbox.monnify.com');
        if (url.protocol !== 'https:' || url.hostname !== 'sandbox.monnify.com' || url.username || url.password || url.port) {
          throw new Error('Invalid sandbox host');
        }
      } catch {
        throw new ServiceUnavailableException({ code: 'MONNIFY_SANDBOX_REQUIRED' });
      }
    }
  }

  @Get('virtual-accounts/validation-banks')
  async virtualAccountValidationBanks(@Req() req: AuthenticatedFastifyRequest) {
    requirePrincipal(req);
    this.assertVirtualAccountSandbox('paystack');
    return { provider: 'paystack', banks: await this.transfers.listBanks('paystack') };
  }

  @Get('virtual-accounts')
  async virtualAccountsForUser(@Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    return {
      virtualAccounts: await this.virtualAccounts.listForUser(principal.userId),
      provisioning: await this.virtualAccounts.listProvisioningForUser(principal.userId),
    };
  }

  @Post('virtual-accounts')
  async virtualAccount(
    @Body(new ZodValidationPipe(VirtualAccountSchema)) body: z.infer<typeof VirtualAccountSchema>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: AuthenticatedFastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    this.assertVirtualAccountSandbox(body.provider);
    const principal = requirePrincipal(req);
    const authorization = await this.financialAuthorization.authorize({ principal, transactionPin: body.transactionPin, amountMinor: 0n, intent: 'VIRTUAL_ACCOUNT' });
    const result = await this.virtualAccounts.create({
      authorization,
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
  async transactions(
    @Query(new ZodValidationPipe(HistoryQuerySchema)) query: z.infer<typeof HistoryQuerySchema>,
    @Req() req: AuthenticatedFastifyRequest,
  ) {
    const principal = requirePrincipal(req);
    const where: Prisma.FinancialTransactionWhereInput = {
      userId: principal.userId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status === 'PENDING' ? { in: ['CREATED', 'AUTHORIZED', 'FUNDS_RESERVED'] as FinancialTransactionStatus[] }
        : query.status === 'IN_FLIGHT' ? { in: ['PROVIDER_SUBMITTED', 'PROCESSING'] as FinancialTransactionStatus[] } : query.status } : {}),
      ...(query.startDate || query.endDate ? { createdAt: {
        ...(query.startDate ? { gte: new Date(`${query.startDate}T00:00:00.000Z`) } : {}),
        ...(query.endDate ? { lt: new Date(Date.parse(`${query.endDate}T00:00:00.000Z`) + 86400000) } : {}),
      } } : {}),
      ...(query.minAmountMinor || query.maxAmountMinor ? { amountMinor: {
        ...(query.minAmountMinor ? { gte: BigInt(query.minAmountMinor) } : {}),
        ...(query.maxAmountMinor ? { lte: BigInt(query.maxAmountMinor) } : {}),
      } } : {}),
    };
    const [total, transactions] = await this.prisma.$transaction([
      this.prisma.financialTransaction.count({ where }),
      this.prisma.financialTransaction.findMany({
        where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit, take: query.limit,
        include: { providerOps: { select: { providerCode: true }, take: 1 } },
      }),
    ]);
    const totalPages = Math.ceil(total / query.limit);
    return {
      transactions: transactions.map((transaction) => ({
        reference: transaction.reference, type: transaction.type, status: transaction.status, currency: transaction.currency,
        amountMinor: transaction.amountMinor.toString(), feeMinor: transaction.feeMinor.toString(),
        ...(transaction.type === 'TRANSFER' ? { totalDebitMinor: (transaction.amountMinor + transaction.feeMinor).toString() } : {}),
        description: transaction.description,
        provider: transaction.providerOps[0]?.providerCode ?? null, createdAt: transaction.createdAt, updatedAt: transaction.updatedAt,
      })),
      pagination: {
        total, page: query.page, limit: query.limit, totalPages,
        hasNext: query.page < totalPages, hasPrev: query.page > 1,
      },
    };
  }

  @Get('transactions/:reference')
  async transaction(@Param('reference') reference: string, @Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    const transaction = await this.prisma.financialTransaction.findFirst({
      where: { reference, userId: principal.userId },
      include: { providerOps: { select: { providerCode: true }, take: 1 }, bankTransfer: { include: { beneficiary: true } } },
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
        ...(transaction.type === 'TRANSFER' ? { totalDebitMinor: (transaction.amountMinor + transaction.feeMinor).toString() } : {}),
        description: transaction.description,
        createdAt: transaction.createdAt,
        updatedAt: transaction.updatedAt,
        provider: transaction.providerOps[0]?.providerCode ?? null,
        beneficiary: transaction.bankTransfer ? {
          bankCode: transaction.bankTransfer.bankCodeSnapshot ?? transaction.bankTransfer.beneficiary.bankCode,
          accountNumber: `******${transaction.bankTransfer.accountLast4Snapshot ?? transaction.bankTransfer.beneficiary.accountNumberLast4}`,
          accountName: transaction.bankTransfer.accountNameSnapshot ?? transaction.bankTransfer.beneficiary.accountName,
        } : null,
      },
    };
  }
}
