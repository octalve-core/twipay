import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { AuditService } from './audit.service.js';
import { assertTransactionalAuthorization } from './transaction-authorization.js';

const TERMINAL = new Set(['SUCCEEDED', 'FAILED', 'REVERSED']);
const MATCHED = new Set(['SUCCEEDED', 'FAILED', 'REVERSED']);

// Passive review only; no automatic timeout-based release or provider outcome inference.
function maskedCase(row: any) {
  const financial = row.financialTransaction;
  const provider = row.providerOperation;
  return {
    id: row.id, type: row.type, status: row.status, summary: row.summary,
    createdAt: row.createdAt, resolvedAt: row.resolvedAt,
    prepared: Boolean(row.reviewPreparedAt),
    preparedBy: row.reviewPreparedByUserId, preparedAt: row.reviewPreparedAt,
    checkedAt: row.reviewCheckedAt,
    financial: financial ? {
      reference: financial.reference, type: financial.type, status: financial.status,
      currency: financial.currency, amountMinor: financial.amountMinor.toString(),
      feeMinor: financial.feeMinor.toString(), createdAt: financial.createdAt,
      holds: financial.holds.map((h: any) => ({ id: h.id, status: h.status,
        amountMinor: h.amountMinor.toString(), expiresAt: h.expiresAt, createdAt: h.createdAt })),
    } : null,
    provider: provider ? { type: provider.type, providerCode: provider.providerCode,
      status: provider.status, createdAt: provider.createdAt } : null,
  };
}

const CASE_INCLUDES = {
  financialTransaction: { select: {
    id: true, reference: true, type: true, status: true, currency: true,
    amountMinor: true, feeMinor: true, createdAt: true,
    holds: { select: { id: true, status: true, amountMinor: true, expiresAt: true, createdAt: true } },
  } },
  providerOperation: { select: { id: true, type: true, providerCode: true, status: true, createdAt: true,
    financialTransactionId: true } },
} as const;

@Injectable()
export class FinancialExceptionService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async queue() {
    const [cases, holds] = await Promise.all([
      this.prisma.reconciliationCase.findMany({
        where: { status: { in: ['OPEN', 'NEEDS_REVIEW'] } },
        orderBy: { createdAt: 'asc' }, take: 100, include: CASE_INCLUDES,
      }),
      this.prisma.walletHold.findMany({
        where: { status: 'ACTIVE', financialTransaction: {
          status: { in: ['FUNDS_RESERVED', 'PROVIDER_SUBMITTED', 'PROCESSING', 'UNKNOWN', 'FAILED', 'SUCCEEDED', 'REVERSED', 'CANCELLED'] },
        } },
        orderBy: { createdAt: 'asc' }, take: 100,
        select: { id: true, status: true, amountMinor: true, expiresAt: true, createdAt: true,
          financialTransaction: { select: { reference: true, status: true, type: true, currency: true } } },
      }),
    ]);
    return { cases: cases.map(maskedCase), activeHolds: holds.map(h => ({
      id: h.id, amountMinor: h.amountMinor.toString(), status: h.status,
      expiresAt: h.expiresAt, createdAt: h.createdAt,
      reference: h.financialTransaction.reference, transactionStatus: h.financialTransaction.status,
      type: h.financialTransaction.type, currency: h.financialTransaction.currency,
    })), bounded: true };
  }

  async prepare(input: { caseId: string; actorUserId: string; sessionId: string; note: string; requestId?: string }) {
    return this.prisma.$transaction(async tx => {
      await assertTransactionalAuthorization(tx, { userId: input.actorUserId, sessionId: input.sessionId,
        permission: 'ops.reconciliation.prepare', recentMfa: true });
      await tx.$queryRaw`SELECT "id" FROM "reconciliation_cases" WHERE "id"=${input.caseId}::uuid FOR UPDATE`;
      const record = await tx.reconciliationCase.findUnique({ where: { id: input.caseId } });
      if (!record) throw new NotFoundException({ code: 'RECONCILIATION_CASE_NOT_FOUND' });
      if (!['OPEN', 'NEEDS_REVIEW'].includes(record.status) || record.reviewPreparedByUserId) {
        throw new ConflictException({ code: 'RECONCILIATION_ALREADY_PREPARED_OR_CLOSED' });
      }
      const next = await tx.reconciliationCase.update({ where: { id: record.id }, data: {
        status: 'NEEDS_REVIEW', reviewPreparedByUserId: input.actorUserId,
        reviewPreparedAt: new Date(), reviewNote: input.note,
      } });
      await this.audit.recordWithTx(tx, { actorUserId: input.actorUserId,
        action: 'FINANCIAL_EXCEPTION_REVIEW_PREPARED', targetType: 'reconciliation_case',
        targetId: record.id, requestId: input.requestId, reason: 'Prepared for independent evidence review',
        beforeState: { status: record.status }, afterState: { status: next.status, prepared: true },
      });
      return { id: next.id, status: next.status, prepared: true };
    }, { isolationLevel: 'Serializable' });
  }

  /** Close only a status-only discrepancy when independent terminal evidence already agrees.
   * Never changes financial statuses, provider operations, journals, wallet balances or holds.
   */
  async closeVerifiedStatusCase(input: { caseId: string; actorUserId: string; sessionId: string; requestId?: string }) {
    return this.prisma.$transaction(async tx => {
      await assertTransactionalAuthorization(tx, { userId: input.actorUserId, sessionId: input.sessionId,
        permission: 'ops.reconciliation.approve', recentMfa: true });
      // Read immutable IDs, then lock financial -> provider -> case in settlement-compatible
      // order. Without these locks terminal evidence could change before the review commits.
      const linkage = await tx.reconciliationCase.findUnique({ where: { id: input.caseId },
        select: { financialTransactionId: true, providerOperationId: true } });
      if (!linkage) throw new NotFoundException({ code: 'RECONCILIATION_CASE_NOT_FOUND' });
      if (!linkage.financialTransactionId || !linkage.providerOperationId) {
        throw new ConflictException({ code: 'RECONCILIATION_UNRESOLVED_FINANCIAL_EVIDENCE' });
      }
      await tx.$queryRaw`SELECT "id" FROM "financial_transactions" WHERE "id"=${linkage.financialTransactionId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "provider_operations" WHERE "id"=${linkage.providerOperationId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "reconciliation_cases" WHERE "id"=${input.caseId}::uuid FOR UPDATE`;
      const record = await tx.reconciliationCase.findUnique({ where: { id: input.caseId }, include: CASE_INCLUDES });
      if (!record) throw new NotFoundException({ code: 'RECONCILIATION_CASE_NOT_FOUND' });
      if (record.financialTransactionId !== linkage.financialTransactionId ||
          record.providerOperationId !== linkage.providerOperationId) {
        throw new ConflictException({ code: 'RECONCILIATION_LINKAGE_CHANGED' });
      }
      if (!['OPEN', 'NEEDS_REVIEW'].includes(record.status) || !record.reviewPreparedByUserId ||
          !record.reviewNote || !record.reviewPreparedAt || record.reviewPreparedByUserId === input.actorUserId) {
        throw new ConflictException({ code: 'INDEPENDENT_RECONCILIATION_REVIEW_REQUIRED' });
      }
      if (record.type !== 'PROVIDER_STATUS_MISMATCH' || !record.financialTransaction || !record.providerOperation ||
          record.providerOperation.financialTransactionId !== record.financialTransaction.id ||
          !MATCHED.has(record.providerOperation.status) ||
          !TERMINAL.has(record.financialTransaction.status) ||
          record.providerOperation.status !== record.financialTransaction.status ||
          record.financialTransaction.holds.some(h => h.status === 'ACTIVE')) {
        throw new ConflictException({ code: 'RECONCILIATION_UNRESOLVED_FINANCIAL_EVIDENCE' });
      }
      // A provider-success claim alone is never evidence of a posted TwiPay ledger entry.
      if (record.financialTransaction.status === 'SUCCEEDED' || record.financialTransaction.status === 'REVERSED') {
        const posted = await tx.journalTransaction.count({ where: {
          financialTransactionId: record.financialTransaction.id, postedAt: { not: null },
        } });
        if (posted < 1) throw new ConflictException({ code: 'RECONCILIATION_POSTED_LEDGER_EVIDENCE_REQUIRED' });
      }
      const next = await tx.reconciliationCase.update({ where: { id: record.id }, data: {
        status: 'RESOLVED', resolvedAt: new Date(), reviewCheckedByUserId: input.actorUserId,
        reviewCheckedAt: new Date(), resolution: {
          classification: 'MATCHED_TERMINAL_STATUS_ONLY',
          financialStatus: record.financialTransaction.status,
          providerStatus: record.providerOperation.status,
          financialReference: record.financialTransaction.reference,
          noMoneyMovementPerformed: true,
        },
      } });
      await this.audit.recordWithTx(tx, { actorUserId: input.actorUserId,
        action: 'FINANCIAL_EXCEPTION_STATUS_REVIEW_CLOSED', targetType: 'reconciliation_case',
        targetId: record.id, requestId: input.requestId,
        beforeState: { status: record.status }, afterState: { status: next.status,
          financialStatus: record.financialTransaction.status, noMoneyMovementPerformed: true },
      });
      return { id: next.id, status: next.status, noMoneyMovementPerformed: true };
    }, { isolationLevel: 'Serializable' });
  }
}
