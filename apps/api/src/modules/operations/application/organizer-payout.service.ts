import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { JsonObject, NormalizedProviderStatus, PayoutResult } from '@twipay/contracts';
import { assertMakerChecker, assertOrganizerPayoutTransition, assertPayoutAmount, calculateAvailableSettlement } from '@twipay/operations';
import { decryptSensitiveString, encryptSensitiveString, fingerprintSensitiveValue } from '@twipay/security';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { FinancialTransactionService } from '../../finance/application/financial-transaction.service.js';
import { IdempotencyService } from '../../finance/application/idempotency.service.js';
import { LedgerService } from '../../finance/application/ledger.service.js';
import { createFinancialReference } from '../../finance/application/reference.js';
import { WalletService } from '../../finance/application/wallet.service.js';
import { PaymentProviderRegistry, type EnabledPaymentProvider } from '../../providers/payment-provider.registry.js';
import { ProductConfigService } from '../../product/application/product-config.service.js';
import { AuditService } from './audit.service.js';
import { deterministicFailure, toOperationsHttpError } from './operations-errors.js';
import { assertTransactionalAuthorization } from './transaction-authorization.js';

const RESERVED_STATUSES = ['REQUESTED','PENDING_APPROVAL','APPROVED','PROVIDER_SUBMITTED','PROCESSING','UNKNOWN'] as const;
function providerStatus(status: NormalizedProviderStatus): 'PROCESSING'|'SUCCEEDED'|'FAILED'|'UNKNOWN'|'REVERSED' {
  if (status === 'PENDING' || status === 'REQUIRES_ACTION') return 'PROCESSING';
  return status;
}
function mask(value: string): string { return `${'*'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`; }

function enforceInvariant(action: () => void, fallbackCode: string): void {
  try { action(); } catch (error) { throw toOperationsHttpError(error, fallbackCode); }
}

@Injectable()
export class OrganizerPayoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: PaymentProviderRegistry,
    private readonly product: ProductConfigService,
    private readonly idempotency: IdempotencyService,
    private readonly financial: FinancialTransactionService,
    private readonly ledger: LedgerService,
    private readonly wallets: WalletService,
    private readonly audit: AuditService,
  ) {}

  async request(input: { ownerUserId: string; sessionId: string; organizerId: string; providerCode: EnabledPaymentProvider; amountMinor: bigint; bankCode: string; accountNumber: string; narration: string; idempotencyKey: string }): Promise<{ statusCode: number; body: JsonObject }> {
    await this.product.assertFeatureEnabled('operations.organizer_payouts', false);
    const idem = await this.idempotency.begin({ scope: 'organizer:payout-request', key: input.idempotencyKey, userId: input.ownerUserId, request: { organizerId: input.organizerId, providerCode: input.providerCode, amountMinor: input.amountMinor.toString(), bankCode: input.bankCode, accountNumberFingerprint: fingerprintSensitiveValue(input.accountNumber, process.env['PII_FINGERPRINT_KEY']!), narration: input.narration }, reclaimStale: true });
    if (idem.replay) return { statusCode: idem.replay.status, body: idem.replay.body };
    const idemId = idem.recordId!;
    try {
      const resolved = await this.providers.get(input.providerCode).resolveBankAccount({ bankCode: input.bankCode, accountNumber: input.accountNumber, currency: 'NGN' });
      if (resolved.accountNumber !== input.accountNumber || resolved.currency !== 'NGN') throw new ConflictException({ code: 'BENEFICIARY_VERIFICATION_MISMATCH' });
      const result = await this.prisma.$transaction(async (tx) => {
        await assertTransactionalAuthorization(tx, { userId: input.ownerUserId, sessionId: input.sessionId, recentMfa: true });
        await tx.$queryRaw`SELECT "id" FROM "event_organizers" WHERE "id"=${input.organizerId}::uuid FOR UPDATE`;
        const organizer = await tx.eventOrganizer.findFirst({ where: { id: input.organizerId, ownerUserId: input.ownerUserId } });
        if (!organizer) throw new NotFoundException({ code: 'EVENT_ORGANIZER_NOT_FOUND' });
        if (organizer.status !== 'ACTIVE') throw new ConflictException({ code: 'EVENT_ORGANIZER_NOT_ACTIVE' });
        const posted = await this.ledger.accountBalanceWithTx(tx, organizer.settlementLedgerAccountId);
        const reserved = await tx.organizerPayout.aggregate({ where: { organizerId: organizer.id, status: { in: [...RESERVED_STATUSES] } }, _sum: { amountMinor: true } });
        const available = calculateAvailableSettlement(posted, reserved._sum.amountMinor ?? 0n);
        enforceInvariant(() => assertPayoutAmount(available, input.amountMinor), 'INVALID_OR_INSUFFICIENT_PAYOUT_AMOUNT');
        const fp = fingerprintSensitiveValue(input.accountNumber, process.env['PII_FINGERPRINT_KEY']!);
        const beneficiary = await tx.beneficiary.upsert({
          where: { userId_bankCode_accountNumberFingerprint_currency: { userId: input.ownerUserId, bankCode: input.bankCode, accountNumberFingerprint: fp, currency: 'NGN' } },
          create: { userId: input.ownerUserId, currency: 'NGN', bankCode: input.bankCode, accountNumberCiphertext: encryptSensitiveString(input.accountNumber, process.env['DATA_ENCRYPTION_KEY']!), accountNumberFingerprint: fp, accountNumberLast4: input.accountNumber.slice(-4), accountName: resolved.accountName },
          update: { accountName: resolved.accountName, accountNumberCiphertext: encryptSensitiveString(input.accountNumber, process.env['DATA_ENCRYPTION_KEY']!), accountNumberLast4: input.accountNumber.slice(-4) },
        });
        const payout = await tx.organizerPayout.create({
          data: { reference: createFinancialReference('orgpay'), organizerId: organizer.id, beneficiaryId: beneficiary.id, amountMinor: input.amountMinor, currency: 'NGN', providerCode: input.providerCode, narration: input.narration, requestedByUserId: input.ownerUserId },
        });
        await this.idempotency.attachResourceWithTx(tx, idemId, 'organizer_payout', payout.id);
        const body: JsonObject = { reference: payout.reference, status: payout.status, amountMinor: payout.amountMinor.toString(), currency: payout.currency, beneficiary: { accountName: beneficiary.accountName, accountNumber: mask(input.accountNumber), bankCode: beneficiary.bankCode } };
        await this.idempotency.completeWithTx(tx, idemId, 201, body);
        return body;
      }, { isolationLevel: 'Serializable' });
      return { statusCode: 201, body: result };
    } catch (error) {
      const publicError = toOperationsHttpError(error, 'ORGANIZER_PAYOUT_REQUEST_REJECTED');
      const failure = deterministicFailure(publicError, 'ORGANIZER_PAYOUT_REQUEST_REJECTED');
      if (failure) await this.idempotency.fail(idemId, failure.status, failure.body);
      else await this.idempotency.releaseProcessing(idemId);
      throw publicError;
    }
  }

  async listForOrganizer(ownerUserId: string, organizerId: string) {
    const organizer = await this.prisma.eventOrganizer.findFirst({ where: { id: organizerId, ownerUserId } });
    if (!organizer) throw new NotFoundException({ code: 'EVENT_ORGANIZER_NOT_FOUND' });
    const rows = await this.prisma.organizerPayout.findMany({
      where: { organizerId }, orderBy: { createdAt: 'desc' }, take: 100,
      select: { reference: true, status: true, amountMinor: true, currency: true, providerCode: true, narration: true, rejectionReason: true, createdAt: true, completedAt: true, beneficiary: { select: { accountName: true, bankCode: true, accountNumberLast4: true } } },
    });
    return rows.map((row) => ({ ...row, amountMinor: row.amountMinor.toString() }));
  }

  async queue() {
    const rows = await this.prisma.organizerPayout.findMany({
      where: { status: { in: [...RESERVED_STATUSES] } },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: { reference: true, status: true, amountMinor: true, currency: true, providerCode: true, narration: true, requestedByUserId: true, preparedByUserId: true, approvedByUserId: true, createdAt: true, organizer: { select: { id: true, name: true, slug: true, ownerUserId: true } }, beneficiary: { select: { accountName: true, bankCode: true, accountNumberLast4: true } } },
    });
    return rows.map((row) => ({ ...row, amountMinor: row.amountMinor.toString() }));
  }

  async prepare(input: { reference: string; makerUserId: string; requestId?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const payout = await tx.organizerPayout.findUniqueOrThrow({ where: { reference: input.reference } });
      if (payout.status !== 'REQUESTED') throw new ConflictException({ code: 'PAYOUT_NOT_REQUESTED' });
      enforceInvariant(() => assertOrganizerPayoutTransition(payout.status, 'PENDING_APPROVAL'), 'PAYOUT_STATE_INVALID');
      const updated = await tx.organizerPayout.update({ where: { id: payout.id }, data: { status: 'PENDING_APPROVAL', preparedByUserId: input.makerUserId } });
      await this.audit.recordWithTx(tx, { actorUserId: input.makerUserId, action: 'ORGANIZER_PAYOUT_PREPARED', targetType: 'organizer_payout', targetId: payout.id, requestId: input.requestId, beforeState: { status: payout.status }, afterState: { status: updated.status } });
      return { reference: updated.reference, status: updated.status, amountMinor: updated.amountMinor.toString(), currency: updated.currency, preparedByUserId: updated.preparedByUserId, approvedByUserId: updated.approvedByUserId };
    });
  }

  async reject(input: { reference: string; actorUserId: string; reason: string; requestId?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const payout = await tx.organizerPayout.findUniqueOrThrow({ where: { reference: input.reference } });
      if (!['REQUESTED','PENDING_APPROVAL'].includes(payout.status)) throw new ConflictException({ code: 'PAYOUT_NOT_REJECTABLE' });
      enforceInvariant(() => assertOrganizerPayoutTransition(payout.status, 'REJECTED'), 'PAYOUT_STATE_INVALID');
      const updated = await tx.organizerPayout.update({ where: { id: payout.id }, data: { status: 'REJECTED', rejectionReason: input.reason } });
      await this.audit.recordWithTx(tx, { actorUserId: input.actorUserId, action: 'ORGANIZER_PAYOUT_REJECTED', targetType: 'organizer_payout', targetId: payout.id, reason: input.reason, requestId: input.requestId, beforeState: { status: payout.status }, afterState: { status: updated.status } });
      return { reference: updated.reference, status: updated.status, amountMinor: updated.amountMinor.toString(), currency: updated.currency, rejectionReason: updated.rejectionReason };
    });
  }

  async approveAndSubmit(input: { reference: string; checkerUserId: string; sessionId: string; mfaSatisfied: boolean; requestId?: string }) {
    if (!input.mfaSatisfied) throw new ConflictException({ code: 'MFA_STEP_UP_REQUIRED' });
    await this.product.assertFeatureEnabled('operations.organizer_payouts', false);
    const prepared = await this.prisma.$transaction(async (tx) => {
      await assertTransactionalAuthorization(tx, { userId: input.checkerUserId, sessionId: input.sessionId, permission: 'ops.payouts.approve', recentMfa: true });
      const payout = await tx.organizerPayout.findUniqueOrThrow({ where: { reference: input.reference }, include: { organizer: true, beneficiary: true } });
      if (payout.status !== 'PENDING_APPROVAL' || !payout.preparedByUserId) throw new ConflictException({ code: 'PAYOUT_NOT_PREPARED' });
      enforceInvariant(() => assertMakerChecker(payout.preparedByUserId!, input.checkerUserId), 'MAKER_CHECKER_SEPARATION_REQUIRED');
      await tx.$queryRaw`SELECT "id" FROM "event_organizers" WHERE "id"=${payout.organizerId}::uuid FOR UPDATE`;
      const posted = await this.ledger.accountBalanceWithTx(tx, payout.organizer.settlementLedgerAccountId);
      const otherReserved = await tx.organizerPayout.aggregate({ where: { organizerId: payout.organizerId, id: { not: payout.id }, status: { in: [...RESERVED_STATUSES] } }, _sum: { amountMinor: true } });
      enforceInvariant(() => assertPayoutAmount(calculateAvailableSettlement(posted, otherReserved._sum.amountMinor ?? 0n), payout.amountMinor), 'INSUFFICIENT_ORGANIZER_SETTLEMENT');
      const financial = await this.financial.createWithTx(tx, { reference: payout.reference, userId: payout.organizer.ownerUserId, type: 'ORGANIZER_PAYOUT', currency: payout.currency, amountMinor: payout.amountMinor, description: payout.narration });
      await this.financial.transitionWithTx(tx, financial.id, 'AUTHORIZED', 'ORGANIZER_PAYOUT_CHECKER_APPROVED', 'ADMIN');
      const operation = await tx.providerOperation.create({ data: { financialTransactionId: financial.id, userId: payout.organizer.ownerUserId, type: 'PAYOUT', providerCode: payout.providerCode, merchantReference: payout.reference } });
      enforceInvariant(() => assertOrganizerPayoutTransition(payout.status, 'APPROVED'), 'PAYOUT_STATE_INVALID');
      await tx.organizerPayout.update({ where: { id: payout.id }, data: { status: 'APPROVED', approvedByUserId: input.checkerUserId, financialTransactionId: financial.id, providerOperationId: operation.id } });
      await this.financial.moveToProviderSubmittedWithTx(tx, financial.id);
      await tx.organizerPayout.update({ where: { id: payout.id }, data: { status: 'PROVIDER_SUBMITTED' } });
      await this.audit.recordWithTx(tx, { actorUserId: input.checkerUserId, action: 'ORGANIZER_PAYOUT_APPROVED_SUBMITTED', targetType: 'organizer_payout', targetId: payout.id, requestId: input.requestId, beforeState: { status: payout.status }, afterState: { status: 'PROVIDER_SUBMITTED', financialReference: financial.reference } });
      return { payout, financialId: financial.id, operationId: operation.id, accountNumber: decryptSensitiveString(payout.beneficiary.accountNumberCiphertext, process.env['DATA_ENCRYPTION_KEY']!) };
    }, { isolationLevel: 'Serializable' });

    const providerCode = prepared.payout.providerCode;
    if (providerCode !== 'paystack' && providerCode !== 'monnify') throw new ConflictException({ code: 'PAYOUT_PROVIDER_NOT_ENABLED' });
    try {
      const result = await this.providers.get(providerCode).createPayout({
        reference: prepared.payout.reference, amountMinor: prepared.payout.amountMinor, currency: 'NGN', narration: prepared.payout.narration,
        beneficiary: { bankCode: prepared.payout.beneficiary.bankCode, accountNumber: prepared.accountNumber, accountName: prepared.payout.beneficiary.accountName },
      });
      return this.applyOutcome(prepared.payout.id, prepared.financialId, prepared.operationId, result);
    } catch {
      return this.markUnknown(prepared.payout.id, prepared.financialId, prepared.operationId, 'ORGANIZER_PAYOUT_CALL_OUTCOME_UNKNOWN');
    }
  }

  async reconcile(reference: string, actorUserId: string, requestId?: string) {
    const payout = await this.prisma.organizerPayout.findUnique({ where: { reference }, include: { financialTransaction: true } });
    if (!payout || !payout.financialTransactionId || !payout.providerOperationId) throw new NotFoundException({ code: 'ORGANIZER_PAYOUT_NOT_FOUND' });
    if (!['PROVIDER_SUBMITTED','PROCESSING','UNKNOWN'].includes(payout.status)) return { reference: payout.reference, status: payout.status, amountMinor: payout.amountMinor.toString(), currency: payout.currency, providerCode: payout.providerCode, completedAt: payout.completedAt };
    if (payout.providerCode !== 'paystack' && payout.providerCode !== 'monnify') throw new ConflictException({ code: 'PAYOUT_PROVIDER_NOT_ENABLED' });
    await this.audit.record({ actorUserId, action: 'ORGANIZER_PAYOUT_RECONCILIATION_REQUESTED', targetType: 'organizer_payout', targetId: payout.id, requestId, beforeState: { status: payout.status, providerCode: payout.providerCode } });
    const operation = await this.prisma.providerOperation.findUniqueOrThrow({ where: { id: payout.providerOperationId } });
    const result = await this.providers.get(payout.providerCode).getPayout({ merchantReference: operation.merchantReference, ...(operation.providerReference ? { providerReference: operation.providerReference } : {}) });
    return this.applyOutcome(payout.id, payout.financialTransactionId, payout.providerOperationId, result);
  }

  private async applyOutcome(payoutId: string, financialId: string, operationId: string, result: PayoutResult) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "financial_transactions" WHERE "id"=${financialId}::uuid FOR UPDATE`;
      const payout = await tx.organizerPayout.findUniqueOrThrow({ where: { id: payoutId }, include: { organizer: true } });
      const financial = await tx.financialTransaction.findUniqueOrThrow({ where: { id: financialId } });
      const monetaryEvidenceRequired = result.status === 'SUCCEEDED' || result.status === 'REVERSED';
      const mismatch = monetaryEvidenceRequired
        ? result.amountMinor !== financial.amountMinor || result.currency !== financial.currency
        : (result.amountMinor !== undefined && result.amountMinor !== financial.amountMinor) || (result.currency !== undefined && result.currency !== financial.currency);
      if (mismatch) return this.markUnknownWithTx(tx, payout, financial, operationId, 'ORGANIZER_PAYOUT_PROVIDER_EVIDENCE_MISMATCH');
      const next = providerStatus(result.status);
      await tx.providerOperation.update({ where: { id: operationId }, data: { status: next, providerReference: result.providerReference ?? undefined, rawStatus: result.rawStatus ?? undefined } });
      if (next === 'SUCCEEDED') {
        const clearing = await this.wallets.systemAccountWithTx(tx, { code: `provider-payout-clearing:${payout.providerCode}`, name: `${payout.providerCode} payout clearing`, category: 'ASSET', normalBalance: 'DEBIT', currency: 'NGN' });
        const journalRef = `jrn:${payout.reference}:organizer-payout`;
        const existing = await tx.journalTransaction.findUnique({ where: { reference: journalRef }, select: { id: true } });
        if (!existing) await this.ledger.postWithTx(tx, { reference: journalRef, financialTransactionId: financial.id, currency: 'NGN', description: 'Verified organizer settlement payout', entries: [
          { accountId: payout.organizer.settlementLedgerAccountId, side: 'DEBIT', amountMinor: payout.amountMinor },
          { accountId: clearing.id, side: 'CREDIT', amountMinor: payout.amountMinor },
        ] });
        if (financial.status !== 'SUCCEEDED') await this.financial.applyProviderOutcomeWithTx(tx, financial.id, 'SUCCEEDED', 'ORGANIZER_PAYOUT_PROVIDER_VERIFIED_SUCCESS');
        await tx.organizerPayout.update({ where: { id: payout.id }, data: { status: 'SUCCEEDED', completedAt: new Date() } });
        return { reference: payout.reference, status: 'SUCCEEDED' };
      }
      if (next === 'REVERSED' && financial.status !== 'SUCCEEDED') {
        return this.markUnknownWithTx(tx, payout, financial, operationId, 'ORGANIZER_PAYOUT_REVERSED_BEFORE_CONFIRMED_SUCCESS');
      }
      if (next === 'REVERSED' && financial.status === 'SUCCEEDED') {
        const journal = await tx.journalTransaction.findUniqueOrThrow({ where: { reference: `jrn:${payout.reference}:organizer-payout` } });
        const reversal = `jrn:${payout.reference}:organizer-payout-reversal`;
        const exists = await tx.journalTransaction.findUnique({ where: { reference: reversal }, select: { id: true } });
        if (!exists) await this.ledger.reverseWithTx(tx, journal.id, reversal, 'Provider-confirmed organizer payout reversal');
        await this.financial.transitionWithTx(tx, financial.id, 'REVERSED', 'ORGANIZER_PAYOUT_REVERSED', 'PROVIDER');
        await tx.organizerPayout.update({ where: { id: payout.id }, data: { status: 'REVERSED', completedAt: new Date() } });
        return { reference: payout.reference, status: 'REVERSED' };
      }
      if (next === 'FAILED') {
        if (!['FAILED','SUCCEEDED','REVERSED'].includes(financial.status)) await this.financial.applyProviderOutcomeWithTx(tx, financial.id, 'FAILED', 'ORGANIZER_PAYOUT_PROVIDER_FAILED');
        await tx.organizerPayout.update({ where: { id: payout.id }, data: { status: 'FAILED', completedAt: new Date() } });
        return { reference: payout.reference, status: 'FAILED' };
      }
      if (next === 'UNKNOWN') return this.markUnknownWithTx(tx, payout, financial, operationId, 'ORGANIZER_PAYOUT_PROVIDER_UNKNOWN');
      await tx.organizerPayout.update({ where: { id: payout.id }, data: { status: 'PROCESSING' } });
      if (financial.status !== 'PROCESSING') await this.financial.applyProviderOutcomeWithTx(tx, financial.id, 'PROCESSING', 'ORGANIZER_PAYOUT_PROCESSING');
      return { reference: payout.reference, status: 'PROCESSING' };
    });
  }

  private async markUnknown(payoutId: string, financialId: string, operationId: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const payout = await tx.organizerPayout.findUniqueOrThrow({ where: { id: payoutId }, include: { organizer: true } });
      const financial = await tx.financialTransaction.findUniqueOrThrow({ where: { id: financialId } });
      return this.markUnknownWithTx(tx, payout, financial, operationId, reason);
    });
  }

  private async markUnknownWithTx(tx: Prisma.TransactionClient, payout: { id: string; reference: string }, financial: { id: string; status: string }, operationId: string, reason: string) {
    await tx.providerOperation.update({ where: { id: operationId }, data: { status: 'UNKNOWN' } });
    await tx.organizerPayout.update({ where: { id: payout.id }, data: { status: 'UNKNOWN' } });
    if (!['SUCCEEDED','FAILED','REVERSED','CANCELLED','UNKNOWN'].includes(financial.status)) await this.financial.applyProviderOutcomeWithTx(tx, financial.id, 'UNKNOWN', reason);
    const existing = await tx.reconciliationCase.findFirst({ where: { providerOperationId: operationId, type: 'ORGANIZER_PAYOUT_MISMATCH', status: { in: ['OPEN','NEEDS_REVIEW'] } } });
    if (!existing) await tx.reconciliationCase.create({ data: { type: 'ORGANIZER_PAYOUT_MISMATCH', status: 'NEEDS_REVIEW', financialTransactionId: financial.id, providerOperationId: operationId, summary: 'Organizer payout outcome requires same-provider reconciliation; settlement reservation remains active' } });
    return { reference: payout.reference, status: 'UNKNOWN' };
  }
}
