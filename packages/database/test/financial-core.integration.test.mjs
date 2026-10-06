import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

test.after(async () => { await prisma.$disconnect(); });

test('database rejects unbalanced journals, late entry appends, and entry mutation', async () => {
  const debit = await prisma.ledgerAccount.create({
    data: { code: `test-debit-${suffix}`, name: 'Test debit', category: 'ASSET', normalBalance: 'DEBIT', currency: 'NGN', system: true },
  });
  const credit = await prisma.ledgerAccount.create({
    data: { code: `test-credit-${suffix}`, name: 'Test credit', category: 'LIABILITY', normalBalance: 'CREDIT', currency: 'NGN', system: true },
  });


  await assert.rejects(
    prisma.journalTransaction.create({ data: { reference: `test-unsealed-${suffix}`, currency: 'NGN' } }),
    /cannot commit while unsealed/,
  );

  await assert.rejects(
    prisma.$transaction(async (tx) => {
      const journal = await tx.journalTransaction.create({
        data: {
          reference: `test-unbalanced-${suffix}`,
          currency: 'NGN',
          entries: { create: [{ ledgerAccountId: debit.id, sequence: 1, side: 'DEBIT', amountMinor: 1000n }] },
        },
      });
      await tx.journalTransaction.update({ where: { id: journal.id }, data: { postedAt: new Date() } });
    }),
    /Unbalanced TwiPay journal/,
  );

  const journal = await prisma.$transaction(async (tx) => {
    const created = await tx.journalTransaction.create({
      data: {
        reference: `test-balanced-${suffix}`,
        currency: 'NGN',
        entries: {
          create: [
            { ledgerAccountId: debit.id, sequence: 1, side: 'DEBIT', amountMinor: 1000n },
            { ledgerAccountId: credit.id, sequence: 2, side: 'CREDIT', amountMinor: 1000n },
          ],
        },
      },
      include: { entries: true },
    });
    return tx.journalTransaction.update({ where: { id: created.id }, data: { postedAt: new Date() }, include: { entries: true } });
  });
  assert.ok(journal.postedAt);
  assert.equal(journal.entries.length, 2);

  await assert.rejects(
    prisma.journalEntry.create({
      data: { journalTransactionId: journal.id, ledgerAccountId: debit.id, sequence: 3, side: 'DEBIT', amountMinor: 1n },
    }),
    /Cannot append entries to a sealed TwiPay journal/,
  );

  await assert.rejects(
    prisma.journalEntry.update({ where: { id: journal.entries[0].id }, data: { amountMinor: 999n } }),
    /immutable financial record/,
  );
});

test('database rejects cross-currency ledger entries and duplicate journal reversals', async () => {
  const ngnDebit = await prisma.ledgerAccount.create({
    data: { code: `test-ngn-debit-${suffix}`, name: 'NGN debit', category: 'ASSET', normalBalance: 'DEBIT', currency: 'NGN', system: true },
  });
  const ngnCredit = await prisma.ledgerAccount.create({
    data: { code: `test-ngn-credit-${suffix}`, name: 'NGN credit', category: 'LIABILITY', normalBalance: 'CREDIT', currency: 'NGN', system: true },
  });
  const usdCredit = await prisma.ledgerAccount.create({
    data: { code: `test-usd-credit-${suffix}`, name: 'USD credit', category: 'LIABILITY', normalBalance: 'CREDIT', currency: 'USD', system: true },
  });

  await assert.rejects(
    prisma.$transaction(async (tx) => {
      const journal = await tx.journalTransaction.create({ data: { reference: `test-cross-currency-${suffix}`, currency: 'NGN' } });
      await tx.journalEntry.create({ data: { journalTransactionId: journal.id, ledgerAccountId: ngnDebit.id, sequence: 1, side: 'DEBIT', amountMinor: 100n } });
      await tx.journalEntry.create({ data: { journalTransactionId: journal.id, ledgerAccountId: usdCredit.id, sequence: 2, side: 'CREDIT', amountMinor: 100n } });
    }),
    /currency must match journal currency/,
  );

  const original = await prisma.$transaction(async (tx) => {
    const journal = await tx.journalTransaction.create({ data: { reference: `test-original-${suffix}`, currency: 'NGN' } });
    await tx.journalEntry.createMany({ data: [
      { journalTransactionId: journal.id, ledgerAccountId: ngnDebit.id, sequence: 1, side: 'DEBIT', amountMinor: 500n },
      { journalTransactionId: journal.id, ledgerAccountId: ngnCredit.id, sequence: 2, side: 'CREDIT', amountMinor: 500n },
    ] });
    return tx.journalTransaction.update({ where: { id: journal.id }, data: { postedAt: new Date() } });
  });

  await prisma.$transaction(async (tx) => {
    const reversal = await tx.journalTransaction.create({ data: { reference: `test-reversal-1-${suffix}`, reversalOfId: original.id, currency: 'NGN' } });
    await tx.journalEntry.createMany({ data: [
      { journalTransactionId: reversal.id, ledgerAccountId: ngnDebit.id, sequence: 1, side: 'CREDIT', amountMinor: 500n },
      { journalTransactionId: reversal.id, ledgerAccountId: ngnCredit.id, sequence: 2, side: 'DEBIT', amountMinor: 500n },
    ] });
    await tx.journalTransaction.update({ where: { id: reversal.id }, data: { postedAt: new Date() } });
  });

  await assert.rejects(
    prisma.journalTransaction.create({ data: { reference: `test-reversal-2-${suffix}`, reversalOfId: original.id, currency: 'NGN' } }),
    /unique|duplicate/i,
  );
});

test('database permits system financial transactions and prevents wallet hold amount rewrites', async () => {
  const systemTx = await prisma.financialTransaction.create({
    data: { reference: `test-system-tx-${suffix}`, type: 'ADJUSTMENT', currency: 'NGN', amountMinor: 1n },
  });
  assert.equal(systemTx.userId, null);

  const user = await prisma.user.create({ data: { email: `ledger-${suffix}@example.com`, status: 'ACTIVE' } });
  const account = await prisma.ledgerAccount.create({
    data: { code: `user-wallet-test-${suffix}`, name: 'User wallet', category: 'LIABILITY', normalBalance: 'CREDIT', currency: 'NGN', ownerUserId: user.id },
  });
  const wallet = await prisma.wallet.create({ data: { userId: user.id, currency: 'NGN', ledgerAccountId: account.id } });
  const financial = await prisma.financialTransaction.create({
    data: { reference: `test-hold-tx-${suffix}`, userId: user.id, type: 'TRANSFER', currency: 'NGN', amountMinor: 100n },
  });
  const hold = await prisma.walletHold.create({ data: { walletId: wallet.id, financialTransactionId: financial.id, amountMinor: 100n } });
  await assert.rejects(
    prisma.walletHold.update({ where: { id: hold.id }, data: { amountMinor: 90n } }),
    /ownership\/amount is immutable/,
  );
});

test('database enforces wallet ownership and financial/transfer state machines', async () => {
  const userA = await prisma.user.create({ data: { email: `guard-a-${suffix}@example.com`, status: 'ACTIVE' } });
  const userB = await prisma.user.create({ data: { email: `guard-b-${suffix}@example.com`, status: 'ACTIVE' } });
  const accountA = await prisma.ledgerAccount.create({
    data: {
      code: `guard-wallet-a-${suffix}`,
      name: 'Guard wallet A',
      category: 'LIABILITY',
      normalBalance: 'CREDIT',
      currency: 'NGN',
      ownerUserId: userA.id,
    },
  });

  await assert.rejects(
    prisma.wallet.create({ data: { userId: userB.id, currency: 'NGN', ledgerAccountId: accountA.id } }),
    /owning user liability account/,
  );

  const financial = await prisma.financialTransaction.create({
    data: { reference: `guard-financial-${suffix}`, userId: userA.id, type: 'TRANSFER', currency: 'NGN', amountMinor: 500n },
  });
  await assert.rejects(
    prisma.financialTransaction.update({ where: { id: financial.id }, data: { amountMinor: 600n } }),
    /instruction fields are immutable/,
  );
  await assert.rejects(
    prisma.financialTransaction.update({ where: { id: financial.id }, data: { status: 'SUCCEEDED' } }),
    /Invalid TwiPay financial transaction transition/,
  );

  const beneficiary = await prisma.beneficiary.create({
    data: {
      userId: userA.id,
      currency: 'NGN',
      bankCode: '001',
      accountNumberCiphertext: 'test-ciphertext',
      accountNumberFingerprint: `${suffix}`.padEnd(64, '0').slice(0, 64),
      accountNumberLast4: '6789',
      accountName: 'Guard User',
    },
  });
  const transfer = await prisma.bankTransfer.create({
    data: { financialTransactionId: financial.id, beneficiaryId: beneficiary.id, narration: 'Guard transfer', status: 'VALIDATED' },
  });
  await assert.rejects(
    prisma.bankTransfer.update({ where: { id: transfer.id }, data: { narration: 'Rewritten instruction' } }),
    /instruction fields are immutable/,
  );
});
