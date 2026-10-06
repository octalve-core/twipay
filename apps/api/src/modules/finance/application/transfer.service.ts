import { Injectable } from '@nestjs/common';
import type { JsonObject, NormalizedProviderStatus, PayoutResult, ResolvedBankAccount } from '@twipay/contracts';
import { encryptSensitiveString, fingerprintSensitiveValue } from '@twipay/security';
import { LedgerInvariantError } from '@twipay/ledger';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { PaymentProviderRegistry, type EnabledPaymentProvider } from '../../providers/payment-provider.registry.js';
import { FinancialTransactionService } from './financial-transaction.service.js';
import { IdempotencyService } from './idempotency.service.js';
import { LedgerService } from './ledger.service.js';
import { createFinancialReference } from './reference.js';
import { WalletService } from './wallet.service.js';


function maskAccountNumber(accountNumber: string): string {
  return accountNumber.length <= 4 ? accountNumber : `${'*'.repeat(accountNumber.length - 4)}${accountNumber.slice(-4)}`;
}

function payoutState(status: NormalizedProviderStatus): 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN' | 'REVERSED' {
  if (status === 'PENDING' || status === 'REQUIRES_ACTION') return 'PROCESSING';
  return status;
}

@Injectable()
export class TransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: PaymentProviderRegistry,
    private readonly idempotency: IdempotencyService,
    private readonly financial: FinancialTransactionService,
    private readonly ledger: LedgerService,
    private readonly wallets: WalletService,
  ) {}

  async resolveBankAccount(input: { providerCode: EnabledPaymentProvider; bankCode: string; accountNumber: string; currency: 'NGN' }) {
    return this.providers.get(input.providerCode).resolveBankAccount(input);
  }

  async createTransfer(input: {
    userId: string;
    idempotencyKey: string;
    providerCode: EnabledPaymentProvider;
    amountMinor: bigint;
    currency: 'NGN';
    bankCode: string;
    accountNumber: string;
    narration: string;
  }): Promise<{ statusCode: number; body: JsonObject }> {
    const provider = this.providers.get(input.providerCode);
    const idem = await this.idempotency.begin({ scope: 'transfer:create', key: input.idempotencyKey, userId: input.userId, request: input });
    if (idem.replay) return { statusCode: idem.replay.status, body: idem.replay.body };
    const recordId = idem.recordId!;

    let resolved: ResolvedBankAccount;
    try {
      resolved = await provider.resolveBankAccount({ bankCode: input.bankCode, accountNumber: input.accountNumber, currency: input.currency });
    } catch {
      const body: JsonObject = { code: 'BENEFICIARY_VERIFICATION_FAILED' };
      await this.idempotency.fail(recordId, 422, body);
      return { statusCode: 422, body };
    }
    if (resolved.accountNumber !== input.accountNumber || resolved.currency !== input.currency) {
      const body: JsonObject = { code: 'BENEFICIARY_VERIFICATION_MISMATCH' };
      await this.idempotency.fail(recordId, 422, body);
      return { statusCode: 422, body };
    }

    const wallet = await this.wallets.ensureUserWallet(input.userId, input.currency);
    const accountNumberFingerprint = fingerprintSensitiveValue(input.accountNumber, process.env.PII_FINGERPRINT_KEY!);
    const accountNumberCiphertext = encryptSensitiveString(input.accountNumber, process.env.DATA_ENCRYPTION_KEY!);
    const accountNumberLast4 = input.accountNumber.slice(-4);
    const reference = createFinancialReference('xfer');
    let prepared: { financial: { id: string }; hold: { id: string }; operation: { id: string } };
    try {
      prepared = await this.prisma.$transaction(async (tx) => {
        const beneficiary = await tx.beneficiary.upsert({
          where: {
            userId_bankCode_accountNumberFingerprint_currency: {
              userId: input.userId,
              bankCode: input.bankCode,
              accountNumberFingerprint,
              currency: input.currency,
            },
          },
          create: {
            userId: input.userId,
            bankCode: input.bankCode,
            accountNumberCiphertext,
            accountNumberFingerprint,
            accountNumberLast4,
            accountName: resolved.accountName,
            currency: input.currency,
          },
          update: { accountName: resolved.accountName, accountNumberCiphertext, accountNumberLast4 },
        });
        const financial = await this.financial.createWithTx(tx, {
          reference,
          userId: input.userId,
          type: 'TRANSFER',
          currency: input.currency,
          amountMinor: input.amountMinor,
          description: input.narration,
        });
        await tx.bankTransfer.create({
          data: {
            financialTransactionId: financial.id,
            beneficiaryId: beneficiary.id,
            narration: input.narration,
            status: 'VALIDATED',
          },
        });
        await this.financial.transitionWithTx(tx, financial.id, 'AUTHORIZED', 'BENEFICIARY_VERIFIED');
        const hold = await this.wallets.reserveWithTx(tx, {
          userId: input.userId,
          walletId: wallet.id,
          financialTransactionId: financial.id,
          amountMinor: input.amountMinor,
        });
        await this.financial.transitionWithTx(tx, financial.id, 'FUNDS_RESERVED', 'WALLET_FUNDS_RESERVED');
        const operation = await tx.providerOperation.create({
          data: {
            financialTransactionId: financial.id,
            userId: input.userId,
            type: 'PAYOUT',
            providerCode: input.providerCode,
            merchantReference: reference,
          },
        });
        return { financial: { id: financial.id }, hold: { id: hold.id }, operation: { id: operation.id } };
      });
    } catch (error) {
      if (error instanceof LedgerInvariantError && error.message === 'insufficient available balance') {
        const body: JsonObject = { code: 'INSUFFICIENT_AVAILABLE_BALANCE' };
        await this.idempotency.fail(recordId, 409, body);
        return { statusCode: 409, body };
      }
      throw error;
    }
    await this.idempotency.attachResource(recordId, 'financial_transaction', prepared.financial.id);

    try {
      const result = await provider.createPayout({
        reference,
        amountMinor: input.amountMinor,
        currency: input.currency,
        narration: input.narration,
        beneficiary: {
          bankCode: input.bankCode,
          accountNumber: input.accountNumber,
          accountName: resolved.accountName,
        },
      });
      const application = await this.applyPayoutOutcome({
        financialTransactionId: prepared.financial.id,
        providerOperationId: prepared.operation.id,
        holdId: prepared.hold.id,
        walletLedgerAccountId: wallet.ledgerAccountId,
        providerCode: input.providerCode,
        result,
      });
      const responseStatus = application === 'REVIEW' ? 'UNKNOWN' : result.status;
      const body: JsonObject = {
        transactionReference: reference,
        provider: input.providerCode,
        status: responseStatus,
        amountMinor: input.amountMinor.toString(),
        currency: input.currency,
        beneficiary: { bankCode: input.bankCode, accountNumber: maskAccountNumber(input.accountNumber), accountName: resolved.accountName },
      };
      await this.idempotency.complete(recordId, responseStatus === 'SUCCEEDED' ? 201 : 202, body);
      return { statusCode: responseStatus === 'SUCCEEDED' ? 201 : 202, body };
    } catch (error) {
      await this.prisma.$transaction(async (tx) => {
        await tx.providerOperation.update({ where: { id: prepared.operation.id }, data: { status: 'UNKNOWN' } });
        await tx.bankTransfer.update({ where: { financialTransactionId: prepared.financial.id }, data: { status: 'UNKNOWN' } });
        await this.financial.moveToProviderSubmittedWithTx(tx, prepared.financial.id);
        const current = await tx.financialTransaction.findUniqueOrThrow({ where: { id: prepared.financial.id } });
        if (current.status !== 'UNKNOWN') await this.financial.transitionWithTx(tx, prepared.financial.id, 'UNKNOWN', 'PAYOUT_CALL_OUTCOME_UNKNOWN', 'PROVIDER');
        await tx.reconciliationCase.create({
          data: {
            type: 'PROVIDER_STATUS_MISMATCH',
            status: 'OPEN',
            financialTransactionId: prepared.financial.id,
            providerOperationId: prepared.operation.id,
            summary: 'Payout provider call ended without a trustworthy final status; wallet hold intentionally retained',
          },
        });
      });
      const body: JsonObject = { transactionReference: reference, provider: input.providerCode, status: 'UNKNOWN', code: 'PROVIDER_OUTCOME_UNKNOWN' };
      await this.idempotency.complete(recordId, 202, body);
      return { statusCode: 202, body };
    }
  }

  async verifyAndApplyPayout(providerCode: EnabledPaymentProvider, merchantReference: string): Promise<void> {
    const operation = await this.prisma.providerOperation.findUnique({
      where: { providerCode_merchantReference: { providerCode, merchantReference } },
      include: { financialTransaction: { include: { holds: true } } },
    });
    const financial = operation?.financialTransaction;
    if (!operation || operation.type !== 'PAYOUT' || !financial) return;
    const hold = financial.holds.find((item) => item.status === 'ACTIVE') ?? financial.holds[0];
    if (!hold) throw new Error('PAYOUT_HOLD_NOT_FOUND');
    const wallet = await this.prisma.wallet.findUniqueOrThrow({ where: { id: hold.walletId } });
    const result = await this.providers.get(providerCode).getPayout({
      merchantReference,
      ...(operation.providerReference ? { providerReference: operation.providerReference } : {}),
    });
    await this.applyPayoutOutcome({
      financialTransactionId: financial.id,
      providerOperationId: operation.id,
      holdId: hold.id,
      walletLedgerAccountId: wallet.ledgerAccountId,
      providerCode,
      result,
    });
  }

  private async applyPayoutOutcome(input: {
    financialTransactionId: string;
    providerOperationId: string;
    holdId: string;
    walletLedgerAccountId: string;
    providerCode: EnabledPaymentProvider;
    result: PayoutResult;
  }): Promise<'APPLIED' | 'REVIEW'> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "financial_transactions" WHERE "id" = ${input.financialTransactionId}::uuid FOR UPDATE`;
      const financial = await tx.financialTransaction.findUniqueOrThrow({ where: { id: input.financialTransactionId } });

      // A provider-supplied amount/currency is evidence and must match our own
      // immutable instruction before it is allowed to move money in the ledger.
      const monetaryEvidenceRequired = input.result.status === 'SUCCEEDED' || input.result.status === 'REVERSED';
      const amountMismatch = monetaryEvidenceRequired
        ? input.result.amountMinor !== financial.amountMinor
        : input.result.amountMinor !== undefined && input.result.amountMinor !== financial.amountMinor;
      const currencyMismatch = monetaryEvidenceRequired
        ? input.result.currency !== financial.currency
        : input.result.currency !== undefined && input.result.currency !== financial.currency;
      if (amountMismatch || currencyMismatch) {
        await tx.providerOperation.update({
          where: { id: input.providerOperationId },
          data: {
            status: 'UNKNOWN',
            ...(input.result.providerReference ? { providerReference: input.result.providerReference } : {}),
            ...(input.result.rawStatus ? { rawStatus: input.result.rawStatus } : {}),
          },
        });
        await tx.reconciliationCase.create({
          data: {
            type: 'AMOUNT_MISMATCH',
            status: 'NEEDS_REVIEW',
            financialTransactionId: financial.id,
            providerOperationId: input.providerOperationId,
            summary: 'Payout provider amount or currency does not match the TwiPay instruction',
            evidence: {
              expectedAmountMinor: financial.amountMinor.toString(),
              providerAmountMinor: input.result.amountMinor?.toString() ?? null,
              expectedCurrency: financial.currency,
              providerCurrency: input.result.currency ?? null,
              providerStatus: input.result.status,
            },
          },
        });
        if (!['SUCCEEDED', 'FAILED', 'REVERSED', 'CANCELLED'].includes(financial.status)) {
          await this.financial.moveToProviderSubmittedWithTx(tx, financial.id);
          const afterSubmit = await tx.financialTransaction.findUniqueOrThrow({ where: { id: financial.id } });
          if (afterSubmit.status !== 'UNKNOWN') {
            await this.financial.transitionWithTx(tx, financial.id, 'UNKNOWN', 'PAYOUT_EVIDENCE_MISMATCH', 'PROVIDER');
          }
        }
        await tx.bankTransfer.update({ where: { financialTransactionId: financial.id }, data: { status: 'UNKNOWN' } });
        return 'REVIEW';
      }

      // A late provider status must never rewrite a contradictory terminal TwiPay
      // outcome. Such discrepancies are operations/reconciliation events.
      const terminal = ['SUCCEEDED', 'FAILED', 'REVERSED', 'CANCELLED'] as const;
      if (terminal.includes(financial.status as (typeof terminal)[number])) {
        const compatible =
          (financial.status === 'SUCCEEDED' && input.result.status === 'SUCCEEDED') ||
          (financial.status === 'FAILED' && input.result.status === 'FAILED') ||
          (financial.status === 'REVERSED' && input.result.status === 'REVERSED');
        const isLegitimateReversal = financial.status === 'SUCCEEDED' && input.result.status === 'REVERSED';

        if (!compatible && !isLegitimateReversal) {
          await tx.reconciliationCase.create({
            data: {
              type: 'PROVIDER_STATUS_MISMATCH',
              status: 'NEEDS_REVIEW',
              financialTransactionId: financial.id,
              providerOperationId: input.providerOperationId,
              summary: `Provider reports ${input.result.status} while TwiPay transfer is terminal ${financial.status}`,
              evidence: { twipayStatus: financial.status, providerStatus: input.result.status },
            },
          });
          return 'REVIEW';
        }
        if (compatible) return 'APPLIED';
      }

      await tx.providerOperation.update({
        where: { id: input.providerOperationId },
        data: {
          status: input.result.status,
          ...(input.result.providerReference ? { providerReference: input.result.providerReference } : {}),
          ...(input.result.rawStatus ? { rawStatus: input.result.rawStatus } : {}),
        },
      });

      if (financial.status !== 'SUCCEEDED') {
        await this.financial.moveToProviderSubmittedWithTx(tx, financial.id);
      }

      if (input.result.status === 'SUCCEEDED') {
        const hold = await tx.walletHold.findUniqueOrThrow({ where: { id: input.holdId } });
        const clearing = await this.wallets.systemAccountWithTx(tx, {
          code: `provider-clearing:${input.providerCode}`,
          name: `${input.providerCode} payout clearing`,
          category: 'ASSET',
          normalBalance: 'DEBIT',
          currency: financial.currency as 'NGN',
        });
        const journalReference = `jrn:${financial.reference}:payout`;
        const existingJournal = await tx.journalTransaction.findUnique({ where: { reference: journalReference }, select: { id: true } });
        if (!existingJournal) {
          await this.ledger.postWithTx(tx, {
            reference: journalReference,
            financialTransactionId: financial.id,
            currency: financial.currency,
            description: 'Verified external bank payout',
            entries: [
              { accountId: input.walletLedgerAccountId, side: 'DEBIT', amountMinor: financial.amountMinor },
              { accountId: clearing.id, side: 'CREDIT', amountMinor: financial.amountMinor },
            ],
          });
        }
        if (hold.status === 'ACTIVE') await this.wallets.captureHoldWithTx(tx, hold.id);
        await tx.bankTransfer.update({ where: { financialTransactionId: financial.id }, data: { status: 'SUCCEEDED' } });
        const current = await tx.financialTransaction.findUniqueOrThrow({ where: { id: financial.id } });
        if (current.status !== 'SUCCEEDED') {
          await this.financial.applyProviderOutcomeWithTx(tx, financial.id, 'SUCCEEDED', 'PAYOUT_VERIFIED_SUCCESS');
        }
        return 'APPLIED';
      }

      if (input.result.status === 'REVERSED' && financial.status === 'SUCCEEDED') {
        const payoutJournal = await tx.journalTransaction.findUnique({ where: { reference: `jrn:${financial.reference}:payout` } });
        if (!payoutJournal) throw new Error('PAYOUT_JOURNAL_MISSING_FOR_REVERSAL');
        const reversalReference = `jrn:${financial.reference}:payout-reversal`;
        const prior = await tx.journalTransaction.findUnique({ where: { reference: reversalReference }, select: { id: true } });
        if (!prior) {
          await this.ledger.reverseWithTx(tx, payoutJournal.id, reversalReference, 'Provider-confirmed payout reversal');
        }
        await tx.bankTransfer.update({ where: { financialTransactionId: financial.id }, data: { status: 'REVERSED' } });
        await this.financial.transitionWithTx(tx, financial.id, 'REVERSED', 'PAYOUT_PROVIDER_REVERSED', 'PROVIDER');
        return 'APPLIED';
      }

      if (input.result.status === 'FAILED' || input.result.status === 'REVERSED') {
        const hold = await tx.walletHold.findUniqueOrThrow({ where: { id: input.holdId } });
        if (hold.status === 'ACTIVE') await this.wallets.releaseHoldWithTx(tx, hold.id);
        await tx.bankTransfer.update({ where: { financialTransactionId: financial.id }, data: { status: input.result.status } });
        const current = await tx.financialTransaction.findUniqueOrThrow({ where: { id: financial.id } });
        if (current.status !== input.result.status) {
          await this.financial.applyProviderOutcomeWithTx(tx, financial.id, input.result.status, 'PAYOUT_VERIFIED_TERMINAL');
        }
        return 'APPLIED';
      }

      const normalized = payoutState(input.result.status);
      await tx.bankTransfer.update({
        where: { financialTransactionId: financial.id },
        data: { status: normalized === 'PROCESSING' ? 'PROCESSING' : 'UNKNOWN' },
      });
      const current = await tx.financialTransaction.findUniqueOrThrow({ where: { id: financial.id } });
      if (current.status !== normalized) {
        await this.financial.applyProviderOutcomeWithTx(tx, financial.id, normalized, 'PAYOUT_PENDING_OR_UNKNOWN');
      }
      return 'APPLIED';
    });
  }
}
