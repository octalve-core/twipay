import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  assertCurrencyCode,
  assertFinancialTransition,
  assertMinorAmount,
  type FinancialTransactionStatus as DomainFinancialStatus,
} from '@twipay/ledger';

interface CreateFinancialTransactionInput {
  reference: string;
  userId?: string;
  type: 'FUNDING' | 'TRANSFER' | 'BILL_PAYMENT' | 'EVENT_PURCHASE' | 'REFUND' | 'REVERSAL' | 'FEE' | 'ADJUSTMENT' | 'ORGANIZER_PAYOUT';
  currency: string;
  amountMinor: bigint;
  feeMinor?: bigint;
  description?: string;
}

@Injectable()
export class FinancialTransactionService {
  async createWithTx(tx: Prisma.TransactionClient, input: CreateFinancialTransactionInput) {
    assertCurrencyCode(input.currency);
    assertMinorAmount(input.amountMinor);
    if ((input.feeMinor ?? 0n) < 0n) throw new Error('FINANCIAL_FEE_CANNOT_BE_NEGATIVE');
    const created = await tx.financialTransaction.create({
      data: {
        reference: input.reference,
        type: input.type,
        currency: input.currency,
        amountMinor: input.amountMinor,
        feeMinor: input.feeMinor ?? 0n,
        ...(input.userId ? { userId: input.userId } : {}),
        ...(input.description ? { description: input.description } : {}),
      },
    });
    await tx.financialTransactionStateChange.create({
      data: { financialTransactionId: created.id, fromStatus: null, toStatus: 'CREATED', reason: 'TRANSACTION_CREATED' },
    });
    return created;
  }

  async transitionWithTx(
    tx: Prisma.TransactionClient,
    id: string,
    toStatus: DomainFinancialStatus,
    reason: string,
    actorType = 'SYSTEM',
  ) {
    const current = await tx.financialTransaction.findUniqueOrThrow({ where: { id } });
    if (current.status === toStatus) return current;
    assertFinancialTransition(current.status as DomainFinancialStatus, toStatus);
    const updated = await tx.financialTransaction.update({ where: { id }, data: { status: toStatus } });
    await tx.financialTransactionStateChange.create({
      data: {
        financialTransactionId: id,
        fromStatus: current.status,
        toStatus,
        reason,
        actorType,
      },
    });
    return updated;
  }

  async settleInternalRefundWithTx(tx: Prisma.TransactionClient, id: string): Promise<void> {
    const current = await tx.financialTransaction.findUniqueOrThrow({ where: { id } });
    if (current.type !== 'REFUND' || current.status !== 'AUTHORIZED') {
      throw new Error('INTERNAL_REFUND_SETTLEMENT_STATE_INVALID');
    }
    const postedJournal = await tx.journalTransaction.findFirst({ where: { financialTransactionId: id, postedAt: { not: null } }, select: { id: true } });
    if (!postedJournal) throw new Error('INTERNAL_REFUND_REQUIRES_POSTED_JOURNAL');
    const updated = await tx.financialTransaction.update({ where: { id }, data: { status: 'SUCCEEDED' } });
    await tx.financialTransactionStateChange.create({
      data: { financialTransactionId: id, fromStatus: current.status, toStatus: updated.status, reason: 'INTERNAL_COMPENSATING_REFUND', actorType: 'SYSTEM' },
    });
  }

  async settleInternalEventPurchaseWithTx(tx: Prisma.TransactionClient, id: string): Promise<void> {
    const current = await tx.financialTransaction.findUniqueOrThrow({ where: { id } });
    if (current.type !== 'EVENT_PURCHASE' || current.status !== 'FUNDS_RESERVED') {
      throw new Error('INTERNAL_EVENT_SETTLEMENT_STATE_INVALID');
    }
    const updated = await tx.financialTransaction.update({ where: { id }, data: { status: 'SUCCEEDED' } });
    await tx.financialTransactionStateChange.create({
      data: { financialTransactionId: id, fromStatus: current.status, toStatus: updated.status, reason: 'INTERNAL_EVENT_SETTLEMENT', actorType: 'SYSTEM' },
    });
  }

  async moveToProviderSubmittedWithTx(tx: Prisma.TransactionClient, id: string): Promise<void> {
    let current = await tx.financialTransaction.findUniqueOrThrow({ where: { id } });
    if (current.status === 'CREATED') {
      current = await this.transitionWithTx(tx, id, 'AUTHORIZED', 'BUSINESS_RULES_AUTHORIZED');
    }
    if (current.status === 'AUTHORIZED' || current.status === 'FUNDS_RESERVED') {
      await this.transitionWithTx(tx, id, 'PROVIDER_SUBMITTED', 'PROVIDER_REQUEST_SUBMITTED');
    }
  }

  async applyProviderOutcomeWithTx(
    tx: Prisma.TransactionClient,
    id: string,
    outcome: 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN' | 'REVERSED',
    reason: string,
  ): Promise<void> {
    await this.moveToProviderSubmittedWithTx(tx, id);
    const current = await tx.financialTransaction.findUniqueOrThrow({ where: { id } });
    if (current.status === outcome) return;
    await this.transitionWithTx(tx, id, outcome, reason, 'PROVIDER');
  }
}
