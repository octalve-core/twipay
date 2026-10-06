import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  assertHoldTransition,
  assertSufficientAvailableBalance,
  calculateAvailableBalance,
  type CurrencyCode,
} from '@twipay/ledger';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { LedgerService } from './ledger.service.js';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService, private readonly ledger: LedgerService) {}

  async ensureUserWallet(userId: string, currency: CurrencyCode = 'NGN') {
    return this.prisma.$transaction((tx) => this.ensureUserWalletWithTx(tx, userId, currency));
  }

  async ensureUserWalletWithTx(tx: Prisma.TransactionClient, userId: string, currency: CurrencyCode) {
    const code = `user-wallet:${userId}:${currency}`;
    const account = await tx.ledgerAccount.upsert({
      where: { code },
      create: {
        code,
        name: `User wallet ${currency}`,
        category: 'LIABILITY',
        normalBalance: 'CREDIT',
        currency,
        ownerUserId: userId,
      },
      update: {},
    });
    if (
      account.ownerUserId !== userId
      || account.category !== 'LIABILITY'
      || account.normalBalance !== 'CREDIT'
      || account.currency !== currency
      || account.system
    ) {
      throw new Error('USER_WALLET_LEDGER_ACCOUNT_CONFIGURATION_MISMATCH');
    }
    return tx.wallet.upsert({
      where: { userId_currency: { userId, currency } },
      create: { userId, currency, ledgerAccountId: account.id },
      update: {},
      include: { ledgerAccount: true },
    });
  }

  async getSummary(userId: string, currency: CurrencyCode = 'NGN') {
    return this.prisma.$transaction(async (tx) => {
      const wallet = await this.ensureUserWalletWithTx(tx, userId, currency);
      const postedBalanceMinor = await this.ledger.accountBalanceWithTx(tx, wallet.ledgerAccountId);
      const now = new Date();
      const holds = await tx.walletHold.aggregate({
        where: {
          walletId: wallet.id,
          status: 'ACTIVE',
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        _sum: { amountMinor: true },
      });
      const activeHoldsMinor = holds._sum.amountMinor ?? 0n;
      return {
        id: wallet.id,
        currency: wallet.currency,
        status: wallet.status,
        postedBalanceMinor,
        activeHoldsMinor,
        availableBalanceMinor: calculateAvailableBalance(postedBalanceMinor, activeHoldsMinor),
      };
    });
  }

  async reserveWithTx(
    tx: Prisma.TransactionClient,
    input: { userId: string; walletId: string; financialTransactionId: string; amountMinor: bigint; expiresAt?: Date },
  ) {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "wallets"
      WHERE "id" = ${input.walletId}::uuid AND "userId" = ${input.userId}::uuid
      FOR UPDATE
    `;
    if (!locked[0]) throw new NotFoundException({ code: 'WALLET_NOT_FOUND' });
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: input.walletId } });
    if (wallet.status !== 'ACTIVE') throw new Error('WALLET_NOT_ACTIVE');
    const posted = await this.ledger.accountBalanceWithTx(tx, wallet.ledgerAccountId);
    const now = new Date();
    const holds = await tx.walletHold.aggregate({
      where: {
        walletId: wallet.id,
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      _sum: { amountMinor: true },
    });
    const active = holds._sum.amountMinor ?? 0n;
    assertSufficientAvailableBalance(calculateAvailableBalance(posted, active), input.amountMinor);
    const hold = await tx.walletHold.create({
      data: {
        walletId: wallet.id,
        financialTransactionId: input.financialTransactionId,
        amountMinor: input.amountMinor,
        ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
      },
    });
    await tx.wallet.update({ where: { id: wallet.id }, data: { version: { increment: 1 } } });
    return hold;
  }

  async captureHoldWithTx(tx: Prisma.TransactionClient, holdId: string) {
    const hold = await tx.walletHold.findUniqueOrThrow({ where: { id: holdId } });
    if (hold.expiresAt && hold.expiresAt.getTime() <= Date.now()) {
      if (hold.status === 'ACTIVE') {
        await tx.walletHold.update({ where: { id: holdId }, data: { status: 'EXPIRED' } });
      }
      throw new Error('WALLET_HOLD_EXPIRED');
    }
    assertHoldTransition(hold.status, 'CAPTURED');
    return tx.walletHold.update({ where: { id: holdId }, data: { status: 'CAPTURED', capturedAt: new Date() } });
  }

  async releaseHoldWithTx(tx: Prisma.TransactionClient, holdId: string) {
    const hold = await tx.walletHold.findUniqueOrThrow({ where: { id: holdId } });
    if (hold.status !== 'ACTIVE') return hold;
    assertHoldTransition(hold.status, 'RELEASED');
    return tx.walletHold.update({ where: { id: holdId }, data: { status: 'RELEASED', releasedAt: new Date() } });
  }

  async systemAccountWithTx(
    tx: Prisma.TransactionClient,
    input: { code: string; name: string; category: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'; normalBalance: 'DEBIT' | 'CREDIT'; currency: CurrencyCode },
  ) {
    const account = await tx.ledgerAccount.upsert({
      where: { code: `${input.code}:${input.currency}` },
      create: {
        code: `${input.code}:${input.currency}`,
        name: input.name,
        category: input.category,
        normalBalance: input.normalBalance,
        currency: input.currency,
        system: true,
      },
      update: {},
    });
    if (
      !account.system
      || account.category !== input.category
      || account.normalBalance !== input.normalBalance
      || account.currency !== input.currency
    ) {
      throw new Error('SYSTEM_LEDGER_ACCOUNT_CONFIGURATION_MISMATCH');
    }
    return account;
  }
}
