import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { JsonObject } from '@twipay/contracts';
import { assertFullRefund, assertMakerChecker, assertRefundTransition } from '@twipay/operations';
import { decryptSensitiveString, encryptSensitiveString } from '@twipay/security';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { FinancialTransactionService } from '../../finance/application/financial-transaction.service.js';
import { IdempotencyService } from '../../finance/application/idempotency.service.js';
import { LedgerService } from '../../finance/application/ledger.service.js';
import { createFinancialReference } from '../../finance/application/reference.js';
import { ProductConfigService } from '../../product/application/product-config.service.js';
import { AuditService } from './audit.service.js';
import { deterministicFailure, toOperationsHttpError } from './operations-errors.js';
import { assertTransactionalAuthorization } from './transaction-authorization.js';

function safeCode(value: string): string {
  if (!/^[A-Z0-9_]{3,80}$/.test(value)) throw new ConflictException({ code: 'INVALID_REASON_CODE' });
  return value;
}

function enforceInvariant(action: () => void, fallbackCode: string): void {
  try { action(); } catch (error) { throw toOperationsHttpError(error, fallbackCode); }
}

@Injectable()
export class DisputeRefundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly financial: FinancialTransactionService,
    private readonly ledger: LedgerService,
    private readonly audit: AuditService,
    private readonly product: ProductConfigService,
  ) {}

  async createDispute(input: { userId: string; financialReference: string; category: string; reasonCode: string; details: string }) {
    const financial = await this.prisma.financialTransaction.findFirst({ where: { reference: input.financialReference, userId: input.userId } });
    if (!financial) throw new NotFoundException({ code: 'TRANSACTION_NOT_FOUND' });
    return this.prisma.dispute.create({
      data: {
        reference: createFinancialReference('dsp'), userId: input.userId, financialTransactionId: financial.id,
        category: safeCode(input.category), reasonCode: safeCode(input.reasonCode),
        detailsCiphertext: encryptSensitiveString(input.details, process.env['DATA_ENCRYPTION_KEY']!),
      },
    });
  }

  async listUserDisputes(userId: string) {
    const rows = await this.prisma.dispute.findMany({ where: { userId }, orderBy: { openedAt: 'desc' }, take: 100 });
    return rows.map((row) => ({ reference: row.reference, status: row.status, category: row.category, reasonCode: row.reasonCode, openedAt: row.openedAt, resolvedAt: row.resolvedAt }));
  }

  async requestEventRefund(input: { userId: string; orderReference: string; reasonCode: string; details: string; idempotencyKey: string }): Promise<{ statusCode: number; body: JsonObject }> {
    await this.product.assertFeatureEnabled('events.refunds', false);
    const idem = await this.idempotency.begin({ scope: 'event:refund-request', key: input.idempotencyKey, userId: input.userId, request: input });
    if (idem.replay) return { statusCode: idem.replay.status, body: idem.replay.body };
    const idemId = idem.recordId!;
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const order = await tx.eventOrder.findFirst({ where: { reference: input.orderReference, userId: input.userId }, include: { financialTransaction: true, tickets: true } });
        if (!order) throw new NotFoundException({ code: 'EVENT_ORDER_NOT_FOUND' });
        if (order.status !== 'PAID' || order.financialTransaction.status !== 'SUCCEEDED') throw new ConflictException({ code: 'EVENT_ORDER_NOT_REFUNDABLE' });
        if (order.tickets.some((ticket) => ticket.status === 'CHECKED_IN')) throw new ConflictException({ code: 'CHECKED_IN_TICKET_NOT_REFUNDABLE' });
        const existing = await tx.refundRequest.findUnique({ where: { originalFinancialTransactionId: order.financialTransactionId } });
        if (existing) {
          const body: JsonObject = { reference: existing.reference, status: existing.status, amountMinor: existing.amountMinor.toString(), currency: existing.currency };
          await this.idempotency.completeWithTx(tx, idemId, 200, body);
          return { statusCode: 200, body };
        }
        enforceInvariant(() => assertFullRefund(order.totalMinor, order.totalMinor), 'REFUND_AMOUNT_MISMATCH');
        const dispute = await tx.dispute.create({
          data: {
            reference: createFinancialReference('dsp'), userId: input.userId, financialTransactionId: order.financialTransactionId,
            category: 'EVENT_REFUND', reasonCode: safeCode(input.reasonCode), detailsCiphertext: encryptSensitiveString(input.details, process.env['DATA_ENCRYPTION_KEY']!),
          },
        });
        const refund = await tx.refundRequest.create({
          data: {
            reference: createFinancialReference('rfdreq'), disputeId: dispute.id, originalFinancialTransactionId: order.financialTransactionId,
            requestedByUserId: input.userId, amountMinor: order.totalMinor, currency: order.currency, reasonCode: safeCode(input.reasonCode),
          },
        });
        await this.idempotency.attachResourceWithTx(tx, idemId, 'refund_request', refund.id);
        const body: JsonObject = { reference: refund.reference, status: refund.status, amountMinor: refund.amountMinor.toString(), currency: refund.currency };
        await this.idempotency.completeWithTx(tx, idemId, 201, body);
        return { statusCode: 201, body };
      }, { isolationLevel: 'Serializable' });
      return result;
    } catch (error) {
      const publicError = toOperationsHttpError(error, 'REFUND_REQUEST_REJECTED');
      const failure = deterministicFailure(publicError, 'REFUND_REQUEST_REJECTED');
      if (failure) await this.idempotency.fail(idemId, failure.status, failure.body);
      else await this.idempotency.releaseProcessing(idemId);
      throw publicError;
    }
  }

  async listRefundQueue() {
    const rows = await this.prisma.refundRequest.findMany({
      where: { status: { in: ['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING', 'UNKNOWN'] } },
      orderBy: { createdAt: 'asc' }, take: 200,
      select: { reference: true, status: true, amountMinor: true, currency: true, reasonCode: true, createdAt: true, completedAt: true, reviewedByUserId: true, approvedByUserId: true, dispute: { select: { reference: true, status: true, category: true } } },
    });
    return rows.map((row) => ({ ...row, amountMinor: row.amountMinor.toString() }));
  }

  async prepareRefund(input: { reference: string; reviewerUserId: string; note: string; requestId?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.refundRequest.findUniqueOrThrow({ where: { reference: input.reference } });
      enforceInvariant(() => assertRefundTransition(current.status, 'UNDER_REVIEW'), 'REFUND_STATE_INVALID');
      const updated = await tx.refundRequest.update({ where: { id: current.id }, data: { status: 'UNDER_REVIEW', reviewedByUserId: input.reviewerUserId, reviewNoteCiphertext: encryptSensitiveString(input.note, process.env['DATA_ENCRYPTION_KEY']!) } });
      if (current.disputeId) await tx.dispute.updateMany({ where: { id: current.disputeId, status: 'OPEN' }, data: { status: 'UNDER_REVIEW', assignedToUserId: input.reviewerUserId } });
      await this.audit.recordWithTx(tx, { actorUserId: input.reviewerUserId, action: 'REFUND_PREPARED', targetType: 'refund_request', targetId: current.id, requestId: input.requestId, beforeState: { status: current.status }, afterState: { status: updated.status } });
      return { reference: updated.reference, status: updated.status, amountMinor: updated.amountMinor.toString(), currency: updated.currency, reviewedByUserId: updated.reviewedByUserId, approvedByUserId: updated.approvedByUserId };
    });
  }

  async rejectRefund(input: { reference: string; actorUserId: string; reason: string; requestId?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.refundRequest.findUniqueOrThrow({ where: { reference: input.reference } });
      enforceInvariant(() => assertRefundTransition(current.status, 'REJECTED'), 'REFUND_STATE_INVALID');
      const updated = await tx.refundRequest.update({ where: { id: current.id }, data: { status: 'REJECTED', reviewNoteCiphertext: encryptSensitiveString(input.reason, process.env['DATA_ENCRYPTION_KEY']!), reviewedByUserId: current.reviewedByUserId ?? input.actorUserId } });
      if (current.disputeId) await tx.dispute.update({ where: { id: current.disputeId }, data: { status: 'REJECTED', resolutionCiphertext: encryptSensitiveString(input.reason, process.env['DATA_ENCRYPTION_KEY']!), resolvedAt: new Date() } });
      await this.audit.recordWithTx(tx, { actorUserId: input.actorUserId, action: 'REFUND_REJECTED', targetType: 'refund_request', targetId: current.id, reason: input.reason, requestId: input.requestId, beforeState: { status: current.status }, afterState: { status: updated.status } });
      return { reference: updated.reference, status: updated.status, amountMinor: updated.amountMinor.toString(), currency: updated.currency, reviewedByUserId: updated.reviewedByUserId, approvedByUserId: updated.approvedByUserId };
    });
  }

  async approveAndExecuteEventRefund(input: { reference: string; approverUserId: string; sessionId: string; mfaSatisfied: boolean; requestId?: string }) {
    if (!input.mfaSatisfied) throw new ConflictException({ code: 'MFA_STEP_UP_REQUIRED' });
    return this.prisma.$transaction(async (tx) => {
      await assertTransactionalAuthorization(tx, { userId: input.approverUserId, sessionId: input.sessionId, permission: 'ops.refunds.approve', recentMfa: true });
      const refund = await tx.refundRequest.findUniqueOrThrow({ where: { reference: input.reference } });
      if (refund.status !== 'UNDER_REVIEW' || !refund.reviewedByUserId) throw new ConflictException({ code: 'REFUND_NOT_PREPARED' });
      enforceInvariant(() => assertMakerChecker(refund.reviewedByUserId!, input.approverUserId), 'MAKER_CHECKER_SEPARATION_REQUIRED');
      enforceInvariant(() => assertRefundTransition(refund.status, 'APPROVED'), 'REFUND_STATE_INVALID');
      const order = await tx.eventOrder.findUniqueOrThrow({
        where: { financialTransactionId: refund.originalFinancialTransactionId },
        include: { event: { include: { organizer: true } }, tickets: true, financialTransaction: true },
      });
      if (order.status !== 'PAID' || order.tickets.some((ticket) => ticket.status === 'CHECKED_IN')) throw new ConflictException({ code: 'EVENT_ORDER_NOT_REFUNDABLE' });
      enforceInvariant(() => assertFullRefund(order.totalMinor, refund.amountMinor), 'REFUND_AMOUNT_MISMATCH');
      await tx.$queryRaw`SELECT "id" FROM "event_organizers" WHERE "id"=${order.event.organizerId}::uuid FOR UPDATE`;
      const organizerBalance = await this.ledger.accountBalanceWithTx(tx, order.event.organizer.settlementLedgerAccountId);
      if (organizerBalance < order.subtotalMinor) throw new ConflictException({ code: 'ORGANIZER_SETTLEMENT_INSUFFICIENT_FOR_REFUND' });

      await tx.refundRequest.update({ where: { id: refund.id }, data: { status: 'APPROVED', approvedByUserId: input.approverUserId } });
      await tx.refundRequest.update({ where: { id: refund.id }, data: { status: 'PROCESSING' } });
      const refundReference = createFinancialReference('rfd');
      const financial = await this.financial.createWithTx(tx, { reference: refundReference, userId: refund.requestedByUserId, type: 'REFUND', currency: refund.currency, amountMinor: refund.amountMinor, description: `Refund of ${order.reference}` });
      await this.financial.transitionWithTx(tx, financial.id, 'AUTHORIZED', 'REFUND_APPROVED', 'ADMIN');
      const originalJournal = await tx.journalTransaction.findUniqueOrThrow({ where: { reference: `jrn:${order.reference}:event` } });
      await this.ledger.reverseWithTx(tx, originalJournal.id, `jrn:${refundReference}:event-refund`, `Full event refund of ${order.reference}`, financial.id);
      await this.financial.settleInternalRefundWithTx(tx, financial.id);
      await tx.refundRequest.update({ where: { id: refund.id }, data: { status: 'SUCCEEDED', refundFinancialTransactionId: financial.id, completedAt: new Date() } });
      await tx.eventOrder.update({ where: { id: order.id }, data: { status: 'REFUNDED' } });
      await tx.eventTicket.updateMany({ where: { orderId: order.id, status: 'ACTIVE' }, data: { status: 'REFUNDED' } });
      if (refund.disputeId) await tx.dispute.update({ where: { id: refund.disputeId }, data: { status: 'RESOLVED', resolutionCiphertext: encryptSensitiveString('Approved full event refund completed.', process.env['DATA_ENCRYPTION_KEY']!), resolvedAt: new Date() } });
      await this.audit.recordWithTx(tx, { actorUserId: input.approverUserId, action: 'REFUND_APPROVED_EXECUTED', targetType: 'refund_request', targetId: refund.id, requestId: input.requestId, beforeState: { status: refund.status }, afterState: { status: 'SUCCEEDED', refundFinancialReference: financial.reference } });
      return { reference: refund.reference, status: 'SUCCEEDED', refundFinancialReference: financial.reference, amountMinor: refund.amountMinor.toString(), currency: refund.currency };
    }, { isolationLevel: 'Serializable' });
  }

  /** Status-only queue: no ciphertext, payout credentials or customer email is returned. */
  async listReviewDisputes() {
    return this.prisma.dispute.findMany({
      where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } },
      orderBy: { openedAt: 'asc' }, take: 100,
      select: { reference: true, status: true, category: true, reasonCode: true, openedAt: true },
    });
  }

  async disputeDetail(reference: string) {
    const row = await this.prisma.dispute.findUnique({
      where: { reference },
      select: {
        reference: true, status: true, category: true, reasonCode: true, openedAt: true, resolvedAt: true, assignedToUserId: true,
        detailsCiphertext: true, resolutionCiphertext: true,
        user: { select: { id: true, email: true, status: true } },
        financialTransaction: { select: { reference: true, type: true, status: true, amountMinor: true, currency: true } },
      },
    });
    if (!row) throw new NotFoundException({ code: 'DISPUTE_NOT_FOUND' });
    return {
      reference: row.reference, status: row.status, category: row.category, reasonCode: row.reasonCode, openedAt: row.openedAt, resolvedAt: row.resolvedAt, assignedToUserId: row.assignedToUserId,
      user: row.user,
      financialTransaction: { ...row.financialTransaction, amountMinor: row.financialTransaction.amountMinor.toString() },
      details: decryptSensitiveString(row.detailsCiphertext, process.env['DATA_ENCRYPTION_KEY']!),
      resolution: row.resolutionCiphertext ? decryptSensitiveString(row.resolutionCiphertext, process.env['DATA_ENCRYPTION_KEY']!) : null,
    };
  }

}
