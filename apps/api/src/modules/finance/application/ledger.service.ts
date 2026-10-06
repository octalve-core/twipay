import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  accountBalanceDelta,
  assertBalanced,
  assertCurrencyCode,
  type LedgerEntryDraft,
  type NormalBalance,
} from '@twipay/ledger';

interface PostJournalInput {
  reference: string;
  financialTransactionId?: string;
  reversalOfId?: string;
  currency: string;
  description?: string;
  entries: readonly Omit<LedgerEntryDraft, 'currency'>[];
}

@Injectable()
export class LedgerService {
  async postWithTx(tx: Prisma.TransactionClient, input: PostJournalInput) {
    const currency = input.currency;
    assertCurrencyCode(currency);
    const entries: LedgerEntryDraft[] = input.entries.map((entry) => ({ ...entry, currency }));
    assertBalanced(entries);
    const journal = await tx.journalTransaction.create({
      data: {
        reference: input.reference,
        currency: input.currency,
        ...(input.financialTransactionId ? { financialTransactionId: input.financialTransactionId } : {}),
        ...(input.reversalOfId ? { reversalOfId: input.reversalOfId } : {}),
        ...(input.description ? { description: input.description } : {}),
        entries: {
          create: entries.map((entry, index) => ({
            ledgerAccountId: entry.accountId,
            sequence: index + 1,
            side: entry.side,
            amountMinor: entry.amountMinor,
            ...(entry.memo ? { memo: entry.memo } : {}),
          })),
        },
      },
    });

    // Sealing is the database-enforced commit point for an immutable journal.
    // PostgreSQL rejects this update unless the entries already balance.
    return tx.journalTransaction.update({
      where: { id: journal.id },
      data: { postedAt: new Date() },
      include: { entries: true },
    });
  }

  async accountBalanceWithTx(tx: Prisma.TransactionClient, ledgerAccountId: string): Promise<bigint> {
    const account = await tx.ledgerAccount.findUniqueOrThrow({
      where: { id: ledgerAccountId },
      select: { normalBalance: true },
    });
    const rows = await tx.journalEntry.groupBy({
      by: ['side'],
      where: { ledgerAccountId, journalTransaction: { postedAt: { not: null } } },
      _sum: { amountMinor: true },
    });
    let balance = 0n;
    for (const row of rows) {
      const amount = row._sum.amountMinor ?? 0n;
      balance += accountBalanceDelta(account.normalBalance as NormalBalance, { side: row.side, amountMinor: amount });
    }
    return balance;
  }

  async reverseWithTx(tx: Prisma.TransactionClient, journalId: string, reference: string, description: string) {
    const existing = await tx.journalTransaction.findUniqueOrThrow({
      where: { id: journalId },
      include: { entries: { orderBy: { sequence: 'asc' } } },
    });
    if (!existing.postedAt) throw new Error('JOURNAL_NOT_SEALED');
    const priorReversal = await tx.journalTransaction.findFirst({ where: { reversalOfId: journalId }, select: { id: true } });
    if (priorReversal) throw new Error('JOURNAL_ALREADY_REVERSED');
    return this.postWithTx(tx, {
      reference,
      reversalOfId: existing.id,
      ...(existing.financialTransactionId ? { financialTransactionId: existing.financialTransactionId } : {}),
      currency: existing.currency,
      description,
      entries: existing.entries.map((entry) => ({
        accountId: entry.ledgerAccountId,
        side: entry.side === 'DEBIT' ? 'CREDIT' : 'DEBIT',
        amountMinor: entry.amountMinor,
        memo: `Reversal of ${existing.reference}`,
      })),
    });
  }
}
