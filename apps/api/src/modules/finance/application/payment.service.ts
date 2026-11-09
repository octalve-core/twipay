import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { CollectionResult, JsonObject, NormalizedProviderStatus, VirtualAccountCreditEvent } from '@twipay/contracts';
import { fingerprintSensitiveValue } from '@twipay/security';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { FinancialAuthorizationService, type FinancialAuthorization } from './financial-authorization.service.js';
import { PaymentProviderRegistry, type EnabledPaymentProvider } from '../../providers/payment-provider.registry.js';
import { IdempotencyService } from './idempotency.service.js';
import { FinancialTransactionService } from './financial-transaction.service.js';
import { LedgerService } from './ledger.service.js';
import { WalletService } from './wallet.service.js';
import { createFinancialReference } from './reference.js';
import { resolveDepositDestination } from './virtual-account-credit-destination.js';

function providerOperationStatus(status: NormalizedProviderStatus) {
  return status;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: FinancialAuthorizationService,
    private readonly providers: PaymentProviderRegistry,
    private readonly idempotency: IdempotencyService,
    private readonly financial: FinancialTransactionService,
    private readonly ledger: LedgerService,
    private readonly wallets: WalletService,
  ) {}

  async createCollection(input: {
    authorization: FinancialAuthorization;
    userId: string;
    idempotencyKey: string;
    providerCode: EnabledPaymentProvider;
    amountMinor: bigint;
    currency: 'NGN';
  }): Promise<{ statusCode: number; body: JsonObject }> {
    const provider = this.providers.get(input.providerCode);
    const idem = await this.idempotency.begin({
      scope: 'funding:create',
      key: input.idempotencyKey,
      userId: input.userId,
      request: { userId: input.userId, providerCode: input.providerCode, amountMinor: input.amountMinor, currency: input.currency },
      reclaimStale: true,
    });
    if (idem.replay) return { statusCode: idem.replay.status, body: idem.replay.body };
    const recordId = idem.recordId!;
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: input.userId } });
    await this.wallets.ensureUserWallet(input.userId, input.currency);
    const reference = createFinancialReference('fund');
    const created = await this.prisma.$transaction(async (tx) => {
      await this.authorization.assertCurrentWithTx(tx, input.authorization, input.amountMinor, { userId: input.userId, intent: 'FUNDING' });
      const financial = await this.financial.createWithTx(tx, {
        reference,
        userId: input.userId,
        type: 'FUNDING',
        currency: input.currency,
        amountMinor: input.amountMinor,
        description: 'Wallet funding',
      });
      await this.financial.transitionWithTx(tx, financial.id, 'AUTHORIZED', 'FUNDING_REQUEST_AUTHORIZED');
      const operation = await tx.providerOperation.create({
        data: {
          financialTransactionId: financial.id,
          userId: input.userId,
          type: 'COLLECTION',
          providerCode: input.providerCode,
          merchantReference: reference,
          status: 'PENDING',
        },
      });
      return { financial, operation };
    });
    await this.idempotency.attachResource(recordId, 'financial_transaction', created.financial.id);

    // Two failure domains, kept apart: the provider call (its outcome is genuinely unknown if it throws) and our own bookkeeping
    // after the provider answered (the outcome is known, only the local record is behind).
    let result: CollectionResult;
    try {
      result = await provider.createCollection({
        reference,
        amountMinor: input.amountMinor,
        currency: input.currency,
        customer: {
          email: user.email,
          ...(user.givenName ? { firstName: user.givenName } : {}),
          ...(user.familyName ? { lastName: user.familyName } : {}),
          ...(user.phoneE164 ? { phoneE164: user.phoneE164 } : {}),
        },
        callbackUrl: `${process.env['APP_URL']}/wallet/fund/complete`,
      });
    } catch {
      await this.prisma.$transaction(async (tx) => {
        await tx.providerOperation.update({ where: { id: created.operation.id }, data: { status: 'UNKNOWN' } });
        await this.financial.moveToProviderSubmittedWithTx(tx, created.financial.id);
        const current = await tx.financialTransaction.findUniqueOrThrow({ where: { id: created.financial.id } });
        if (current.status !== 'UNKNOWN') await this.financial.transitionWithTx(tx, created.financial.id, 'UNKNOWN', 'PROVIDER_CALL_OUTCOME_UNKNOWN', 'PROVIDER');
      });
      const body: JsonObject = {
        transactionReference: reference,
        provider: input.providerCode,
        status: 'UNKNOWN',
        amountMinor: input.amountMinor.toString(),
        currency: input.currency,
        code: 'PROVIDER_OUTCOME_UNKNOWN',
      };
      await this.idempotency.complete(recordId, 202, body);
      return { statusCode: 202, body };
    }

    // The provider accepted the request and the customer must get the checkout link. A transient database error here is retried
    // once; if it persists the operation stays PENDING and the provider webhook or a requery settles it by merchant reference
    // (`applyProviderOutcomeWithTx` moves AUTHORIZED forward itself). It is never recorded as UNKNOWN: that would drop the checkout
    // link and claim an outcome we do know.
    let recorded = false;
    for (let attempt = 1; attempt <= 2 && !recorded; attempt += 1) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.providerOperation.update({
            where: { id: created.operation.id },
            data: {
              providerReference: result.providerReference,
              status: providerOperationStatus(result.status),
              ...(result.rawStatus ? { rawStatus: result.rawStatus } : {}),
            },
          });
          await this.financial.moveToProviderSubmittedWithTx(tx, created.financial.id);
          if (result.status === 'PROCESSING') {
            await this.financial.transitionWithTx(tx, created.financial.id, 'PROCESSING', 'PROVIDER_PROCESSING', 'PROVIDER');
          }
        });
        recorded = true;
      } catch (error) {
        this.logger.error({ event: 'COLLECTION_BOOKKEEPING_FAILED', attempt, reference, providerCode: input.providerCode, providerReference: result.providerReference, errorName: error instanceof Error ? error.name : 'UnknownError' });
      }
    }
    const body: JsonObject = {
      transactionReference: reference,
      provider: input.providerCode,
      status: result.status,
      amountMinor: input.amountMinor.toString(),
      currency: input.currency,
      ...(result.checkoutUrl ? { checkoutUrl: result.checkoutUrl } : {}),
    };
    await this.idempotency.complete(recordId, 201, body);
    return { statusCode: 201, body };
  }

  async verifyAndSettleCollection(providerCode: EnabledPaymentProvider, merchantReference: string): Promise<void> {
    const operation = await this.prisma.providerOperation.findUnique({
      where: { providerCode_merchantReference: { providerCode, merchantReference } },
      include: { financialTransaction: true },
    });
    if (!operation?.financialTransaction || operation.type !== 'COLLECTION') return;

    const provider = this.providers.get(providerCode);
    const verified = await provider.getCollection({
      merchantReference,
      ...(operation.providerReference ? { providerReference: operation.providerReference } : {}),
    });
    const financial = operation.financialTransaction;

    if (verified.status === 'SUCCEEDED') {
      if (verified.amountMinor !== financial.amountMinor || verified.currency !== financial.currency) {
        await this.prisma.reconciliationCase.create({
          data: {
            type: 'AMOUNT_MISMATCH',
            status: 'NEEDS_REVIEW',
            financialTransactionId: financial.id,
            providerOperationId: operation.id,
            summary: 'Collection verification amount or currency does not match TwiPay transaction',
            evidence: {
              expectedAmountMinor: financial.amountMinor.toString(),
              verifiedAmountMinor: verified.amountMinor?.toString() ?? null,
              expectedCurrency: financial.currency,
              verifiedCurrency: verified.currency ?? null,
            },
          },
        });
        return;
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "financial_transactions" WHERE "id" = ${financial.id}::uuid FOR UPDATE`;
        const current = await tx.financialTransaction.findUniqueOrThrow({ where: { id: financial.id } });

        if (current.status === 'SUCCEEDED') return;
        if (['FAILED', 'REVERSED', 'CANCELLED'].includes(current.status)) {
          await tx.reconciliationCase.create({
            data: {
              type: 'PROVIDER_STATUS_MISMATCH',
              status: 'NEEDS_REVIEW',
              financialTransactionId: current.id,
              providerOperationId: operation.id,
              summary: `Provider reports successful funding while TwiPay status is terminal ${current.status}`,
              evidence: { twipayStatus: current.status, providerStatus: verified.status },
            },
          });
          return;
        }

        const wallet = await this.wallets.ensureUserWalletWithTx(tx, financial.userId!, financial.currency as 'NGN');
        const clearing = await this.wallets.systemAccountWithTx(tx, {
          code: `provider-clearing:${providerCode}`,
          name: `${providerCode} collection clearing`,
          category: 'ASSET',
          normalBalance: 'DEBIT',
          currency: financial.currency as 'NGN',
        });
        const journalReference = `jrn:${financial.reference}:funding`;
        const existingJournal = await tx.journalTransaction.findUnique({ where: { reference: journalReference }, select: { id: true } });
        if (!existingJournal) {
          await this.ledger.postWithTx(tx, {
            reference: journalReference,
            financialTransactionId: financial.id,
            currency: financial.currency,
            description: 'Verified wallet funding',
            entries: [
              { accountId: clearing.id, side: 'DEBIT', amountMinor: financial.amountMinor },
              { accountId: wallet.ledgerAccountId, side: 'CREDIT', amountMinor: financial.amountMinor },
            ],
          });
        }
        await tx.providerOperation.update({
          where: { id: operation.id },
          data: {
            status: 'SUCCEEDED',
            ...(verified.rawStatus ? { rawStatus: verified.rawStatus } : {}),
            providerReference: verified.providerReference,
          },
        });
        await this.financial.applyProviderOutcomeWithTx(tx, financial.id, 'SUCCEEDED', 'COLLECTION_VERIFIED_SERVER_SIDE');
      });
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "financial_transactions" WHERE "id" = ${financial.id}::uuid FOR UPDATE`;
      const current = await tx.financialTransaction.findUniqueOrThrow({ where: { id: financial.id } });

      await tx.providerOperation.update({
        where: { id: operation.id },
        data: {
          status: providerOperationStatus(verified.status),
          ...(verified.rawStatus ? { rawStatus: verified.rawStatus } : {}),
          ...(verified.providerReference ? { providerReference: verified.providerReference } : {}),
        },
      });

      // A provider-confirmed funding reversal must reverse the accounting entry;
      // changing only the transaction status would leave the wallet overstated.
      if (verified.status === 'REVERSED' && current.status === 'SUCCEEDED') {
        const fundingJournal = await tx.journalTransaction.findUnique({ where: { reference: `jrn:${financial.reference}:funding` } });
        if (!fundingJournal) throw new Error('FUNDING_JOURNAL_MISSING_FOR_REVERSAL');
        const reversalReference = `jrn:${financial.reference}:funding-reversal`;
        const prior = await tx.journalTransaction.findUnique({ where: { reference: reversalReference }, select: { id: true } });
        if (!prior) {
          await this.ledger.reverseWithTx(tx, fundingJournal.id, reversalReference, 'Provider-confirmed funding reversal');
        }
        await this.financial.transitionWithTx(tx, financial.id, 'REVERSED', 'FUNDING_PROVIDER_REVERSED', 'PROVIDER');
        return;
      }

      if (['SUCCEEDED', 'FAILED', 'REVERSED', 'CANCELLED'].includes(current.status)) {
        const compatible =
          (current.status === 'FAILED' && verified.status === 'FAILED') ||
          (current.status === 'REVERSED' && verified.status === 'REVERSED');
        if (!compatible && verified.status !== 'PROCESSING' && verified.status !== 'UNKNOWN') {
          await tx.reconciliationCase.create({
            data: {
              type: 'PROVIDER_STATUS_MISMATCH',
              status: 'NEEDS_REVIEW',
              financialTransactionId: current.id,
              providerOperationId: operation.id,
              summary: `Provider reports ${verified.status} while TwiPay funding is terminal ${current.status}`,
              evidence: { twipayStatus: current.status, providerStatus: verified.status },
            },
          });
        }
        return;
      }

      if (verified.status === 'FAILED' || verified.status === 'UNKNOWN' || verified.status === 'PROCESSING' || verified.status === 'REVERSED') {
        await this.financial.applyProviderOutcomeWithTx(tx, financial.id, verified.status, 'COLLECTION_REQUERY_RESULT');
      }
    });
  }

  async verifyAndSettleVirtualAccountCredit(
    providerCode: EnabledPaymentProvider,
    credit: VirtualAccountCreditEvent,
  ): Promise<void> {
    const provider = this.providers.get(providerCode);
    const verified = await provider.getCollection({
      merchantReference: credit.collectionReference,
      ...(credit.providerReference ? { providerReference: credit.providerReference } : {}),
    });

    if (verified.status !== 'SUCCEEDED' || verified.amountMinor === undefined || !verified.currency) {
      await this.prisma.reconciliationCase.create({
        data: {
          type: 'PROVIDER_STATUS_MISMATCH',
          status: verified.status === 'PROCESSING' || verified.status === 'UNKNOWN' ? 'OPEN' : 'NEEDS_REVIEW',
          summary: 'Virtual-account credit webhook was not confirmed as a successful collection by server-side requery',
          evidence: {
            providerCode,
            collectionReference: credit.collectionReference,
            providerStatus: verified.status,
          },
        },
      });
      return;
    }

    const verifiedAmountMinor = verified.amountMinor;
    const verifiedCurrency = verified.currency;

    if (verifiedCurrency !== 'NGN') {
      await this.prisma.reconciliationCase.create({
        data: {
          type: 'AMOUNT_MISMATCH',
          status: 'NEEDS_REVIEW',
          summary: 'Virtual-account funding returned a currency outside the V1 NGN wallet policy',
          evidence: { providerCode, collectionReference: credit.collectionReference, verifiedCurrency },
        },
      });
      return;
    }

    if ((credit.amountMinor !== undefined && credit.amountMinor !== verifiedAmountMinor)
      || (credit.currency !== undefined && credit.currency !== verifiedCurrency)) {
      await this.prisma.reconciliationCase.create({
        data: {
          type: 'AMOUNT_MISMATCH',
          status: 'NEEDS_REVIEW',
          summary: 'Virtual-account webhook amount/currency conflicts with provider server-side verification',
          evidence: {
            providerCode,
            collectionReference: credit.collectionReference,
            webhookAmountMinor: credit.amountMinor?.toString() ?? null,
            verifiedAmountMinor: verifiedAmountMinor.toString(),
            webhookCurrency: credit.currency ?? null,
            verifiedCurrency,
          },
        },
      });
      return;
    }

    // The provider requery establishes settlement, not destination ownership.
    // Both supplied account identifiers must independently resolve to the same
    // ACTIVE NGN account; unknown or contradictory identifiers require review.
    const accountFingerprint = credit.accountNumber
      ? fingerprintSensitiveValue(credit.accountNumber, process.env['PII_FINGERPRINT_KEY']!) : undefined;
    const byReference = credit.accountReference
      ? await this.prisma.virtualAccount.findUnique({
          where: { providerCode_accountReference: { providerCode, accountReference: credit.accountReference } },
        }) : null;
    const byNumber = accountFingerprint
      ? await this.prisma.virtualAccount.findUnique({
          where: { providerCode_accountNumberFingerprint: { providerCode, accountNumberFingerprint: accountFingerprint } },
        }) : null;
    const destination = resolveDepositDestination({
      providerCode,
      ...(credit.accountReference ? { accountReference: credit.accountReference } : {}),
      ...(accountFingerprint ? { accountNumberFingerprint: accountFingerprint } : {}),
      byReference, byNumber,
    });
    if (!destination.ok) {
      await this.prisma.reconciliationCase.create({
        data: {
          type: destination.code === 'ACCOUNT_IDENTIFIERS_CONFLICT' ? 'PROVIDER_STATUS_MISMATCH' : 'MISSING_INTERNAL',
          status: 'NEEDS_REVIEW',
          summary: `Virtual-account deposit destination cannot be credited: ${destination.code}`,
          evidence: {
            providerCode, collectionReference: credit.collectionReference,
            accountReference: credit.accountReference ?? null,
            accountNumberLast4: credit.accountNumber?.slice(-4) ?? null,
            reason: destination.code,
          },
        },
      });
      return;
    }
    const virtualAccount = destination.account;

    const providerReference = verified.providerReference || credit.providerReference || credit.collectionReference;
    const digest = createHash('sha256')
      .update(`${providerCode}|${providerReference}|${credit.collectionReference}`)
      .digest('hex')
      .slice(0, 32);
    const financialReference = `vaf:${providerCode}:${digest}`;
    const operationReference = `va-credit:${digest}`;

    await this.prisma.$transaction(async (tx) => {
      // Transaction-scoped advisory lock closes the duplicate-credit race even
      // when a provider emits multiple valid webhook envelopes for one deposit.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${providerCode}|${providerReference}`}, 0))`;

      const existingOperation = await tx.providerOperation.findFirst({
        where: { providerCode, type: 'COLLECTION', providerReference },
        include: { financialTransaction: true },
      });
      if (existingOperation?.status === 'SUCCEEDED') return;
      if (existingOperation) {
        await tx.reconciliationCase.create({
          data: {
            type: 'DUPLICATE_EVENT',
            status: 'NEEDS_REVIEW',
            financialTransactionId: existingOperation.financialTransactionId,
            providerOperationId: existingOperation.id,
            summary: 'Duplicate virtual-account provider reference reached settlement in a non-terminal internal state',
            evidence: { providerCode, providerReference },
          },
        });
        return;
      }

      // Serialize account revocation/reassignment against the credit. A previously
      // verified destination is not sufficient if it changed before settlement.
      await tx.$queryRaw`SELECT "id" FROM "virtual_accounts" WHERE "id" = ${virtualAccount.id}::uuid FOR UPDATE`;
      const lockedAccount = await tx.virtualAccount.findUnique({ where: { id: virtualAccount.id } });
      if (!lockedAccount || lockedAccount.status !== 'ACTIVE' || lockedAccount.currency !== verifiedCurrency ||
          lockedAccount.userId !== virtualAccount.userId || lockedAccount.providerCode !== providerCode ||
          lockedAccount.accountReference !== virtualAccount.accountReference ||
          lockedAccount.accountNumberFingerprint !== virtualAccount.accountNumberFingerprint) {
        await tx.reconciliationCase.create({
          data: {
            type: 'PROVIDER_STATUS_MISMATCH', status: 'NEEDS_REVIEW',
            summary: 'Assigned virtual account changed before wallet credit could be posted',
            evidence: { providerCode, collectionReference: credit.collectionReference },
          },
        });
        return;
      }
      const wallet = await this.wallets.ensureUserWalletWithTx(tx, virtualAccount.userId, verifiedCurrency);
      const financial = await this.financial.createWithTx(tx, {
        reference: financialReference,
        userId: virtualAccount.userId,
        type: 'FUNDING',
        currency: verifiedCurrency,
        amountMinor: verifiedAmountMinor,
        description: 'Virtual account funding',
      });
      await this.financial.transitionWithTx(tx, financial.id, 'AUTHORIZED', 'VIRTUAL_ACCOUNT_DEPOSIT_VERIFIED');
      await this.financial.moveToProviderSubmittedWithTx(tx, financial.id);

      const operation = await tx.providerOperation.create({
        data: {
          userId: virtualAccount.userId,
          financialTransactionId: financial.id,
          type: 'COLLECTION',
          providerCode,
          merchantReference: operationReference,
          providerReference,
          status: 'SUCCEEDED',
          ...(verified.rawStatus ? { rawStatus: verified.rawStatus } : {}),
        },
      });

      const clearing = await this.wallets.systemAccountWithTx(tx, {
        code: `provider-clearing:${providerCode}`,
        name: `${providerCode} collection clearing`,
        category: 'ASSET',
        normalBalance: 'DEBIT',
        currency: verifiedCurrency,
      });
      await this.ledger.postWithTx(tx, {
        reference: `jrn:${financialReference}:funding`,
        financialTransactionId: financial.id,
        currency: verifiedCurrency,
        description: 'Server-verified virtual account funding',
        entries: [
          { accountId: clearing.id, side: 'DEBIT', amountMinor: verifiedAmountMinor },
          { accountId: wallet.ledgerAccountId, side: 'CREDIT', amountMinor: verifiedAmountMinor },
        ],
      });
      await this.financial.applyProviderOutcomeWithTx(tx, financial.id, 'SUCCEEDED', 'VIRTUAL_ACCOUNT_COLLECTION_VERIFIED');

      // Explicit reference to operation keeps the intent clear for future fee/settlement extensions.
      void operation;
    });
  }

}
