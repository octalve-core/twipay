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

test('Batch 3 database guards bill instructions and service state transitions', async () => {
  const user = await prisma.user.create({ data: { email: `bill-guard-${suffix}@example.com`, status: 'ACTIVE' } });
  const product = await prisma.billProduct.create({
    data: { code: `bill-product-${suffix}`, category: 'DATA', name: 'Guard Data', customerIdentifierType: 'PHONE', currency: 'NGN', fixedAmountMinor: 1000n },
  });
  const offer = await prisma.billProviderOffer.create({
    data: { productId: product.id, providerCode: 'guard', providerProductCode: `p-${suffix}`, providerBillerCode: `b-${suffix}` },
  });
  const financial = await prisma.financialTransaction.create({
    data: { reference: `bill-fin-${suffix}`, userId: user.id, type: 'BILL_PAYMENT', currency: 'NGN', amountMinor: 1000n },
  });
  const purchase = await prisma.billPurchase.create({
    data: {
      userId: user.id, financialTransactionId: financial.id, productId: product.id, providerOfferId: offer.id,
      customerIdentifierCiphertext: 'cipher', customerIdentifierFingerprint: 'a'.repeat(64), customerIdentifierLast4: '0000', amountMinor: 1000n, currency: 'NGN', providerRequestReference: `provider-request-${suffix}`.slice(0, 160),
    },
  });
  await assert.rejects(
    prisma.billPurchase.update({ where: { id: purchase.id }, data: { amountMinor: 1100n } }),
    /bill purchase instruction is immutable/,
  );
  await assert.rejects(
    prisma.billPurchase.update({ where: { id: purchase.id }, data: { providerRequestReference: `rewritten-${suffix}`.slice(0, 160) } }),
    /bill purchase instruction is immutable/,
  );
  await prisma.billPurchase.update({ where: { id: purchase.id }, data: { status: 'VALIDATED' } });
  await assert.rejects(
    prisma.billPurchase.update({ where: { id: purchase.id }, data: { status: 'SUCCEEDED' } }),
    /invalid bill purchase state transition/,
  );
});

test('Batch 3 only permits direct internal financial settlement for EVENT_PURCHASE', async () => {
  const user = await prisma.user.create({ data: { email: `internal-settle-${suffix}@example.com`, status: 'ACTIVE' } });
  const transfer = await prisma.financialTransaction.create({
    data: { reference: `transfer-direct-${suffix}`, userId: user.id, type: 'TRANSFER', currency: 'NGN', amountMinor: 100n },
  });
  await prisma.financialTransaction.update({ where: { id: transfer.id }, data: { status: 'AUTHORIZED' } });
  await prisma.financialTransaction.update({ where: { id: transfer.id }, data: { status: 'FUNDS_RESERVED' } });
  await assert.rejects(
    prisma.financialTransaction.update({ where: { id: transfer.id }, data: { status: 'SUCCEEDED' } }),
    /Invalid TwiPay financial transaction transition/,
  );

  const eventPurchase = await prisma.financialTransaction.create({
    data: { reference: `event-direct-${suffix}`, userId: user.id, type: 'EVENT_PURCHASE', currency: 'NGN', amountMinor: 100n },
  });
  await prisma.financialTransaction.update({ where: { id: eventPurchase.id }, data: { status: 'AUTHORIZED' } });
  await prisma.financialTransaction.update({ where: { id: eventPurchase.id }, data: { status: 'FUNDS_RESERVED' } });
  const eventDebit = await prisma.ledgerAccount.create({
    data: { code: `event-direct-debit-${suffix}`, name: 'Event direct debit', category: 'ASSET', normalBalance: 'DEBIT', currency: 'NGN', system: true },
  });
  const eventCredit = await prisma.ledgerAccount.create({
    data: { code: `event-direct-credit-${suffix}`, name: 'Event direct credit', category: 'LIABILITY', normalBalance: 'CREDIT', currency: 'NGN', system: true },
  });
  await prisma.$transaction(async (tx) => {
    const journal = await tx.journalTransaction.create({ data: { reference: `event-direct-journal-${suffix}`, financialTransactionId: eventPurchase.id, currency: 'NGN' } });
    await tx.journalEntry.createMany({ data: [
      { journalTransactionId: journal.id, ledgerAccountId: eventDebit.id, sequence: 1, side: 'DEBIT', amountMinor: 100n },
      { journalTransactionId: journal.id, ledgerAccountId: eventCredit.id, sequence: 2, side: 'CREDIT', amountMinor: 100n },
    ] });
    await tx.journalTransaction.update({ where: { id: journal.id }, data: { postedAt: new Date() } });
  });
  const settled = await prisma.financialTransaction.update({ where: { id: eventPurchase.id }, data: { status: 'SUCCEEDED' } });
  assert.equal(settled.status, 'SUCCEEDED');
});

test('Batch 3 event order items and ticket credentials remain immutable and refunds are not enabled', async () => {
  const user = await prisma.user.create({ data: { email: `event-guard-${suffix}@example.com`, status: 'ACTIVE' } });
  const settlement = await prisma.ledgerAccount.create({
    data: { code: `event-settlement-${suffix}`, name: 'Event settlement', category: 'LIABILITY', normalBalance: 'CREDIT', currency: 'NGN', system: true },
  });
  const organizer = await prisma.eventOrganizer.create({
    data: { ownerUserId: user.id, name: 'Guard Organizer', slug: `guard-organizer-${suffix}`.slice(0, 120), settlementLedgerAccountId: settlement.id },
  });
  const event = await prisma.event.create({
    data: { organizerId: organizer.id, slug: `guard-event-${suffix}`.slice(0, 160), title: 'Guard Event', currency: 'NGN', startsAt: new Date(Date.now() + 86_400_000) },
  });
  const ticketType = await prisma.eventTicketType.create({
    data: { eventId: event.id, name: 'General', priceMinor: 1000n, currency: 'NGN', capacity: 10 },
  });
  const feeMismatchFinancial = await prisma.financialTransaction.create({
    data: { reference: `event-order-fee-mismatch-${suffix}`, userId: user.id, type: 'EVENT_PURCHASE', currency: 'NGN', amountMinor: 1000n, feeMinor: 1n },
  });
  await assert.rejects(
    prisma.eventOrder.create({
      data: {
        reference: `event-order-fee-mismatch-order-${suffix}`, userId: user.id, eventId: event.id, financialTransactionId: feeMismatchFinancial.id,
        subtotalMinor: 1000n, platformFeeMinor: 0n, totalMinor: 1000n, currency: 'NGN', expiresAt: new Date(Date.now() + 600_000),
      },
    }),
    /event order financial fee mismatch/,
  );

  const financial = await prisma.financialTransaction.create({
    data: { reference: `event-order-fin-${suffix}`, userId: user.id, type: 'EVENT_PURCHASE', currency: 'NGN', amountMinor: 1000n },
  });
  const order = await prisma.eventOrder.create({
    data: {
      reference: `event-order-${suffix}`, userId: user.id, eventId: event.id, financialTransactionId: financial.id,
      subtotalMinor: 1000n, platformFeeMinor: 0n, totalMinor: 1000n, currency: 'NGN', expiresAt: new Date(Date.now() + 600_000),
      items: { create: [{ ticketTypeId: ticketType.id, quantity: 1, unitPriceMinor: 1000n, lineTotalMinor: 1000n }] },
    },
    include: { items: true },
  });
  await assert.rejects(
    prisma.eventOrder.update({ where: { id: order.id }, data: { totalMinor: 999n } }),
    /event order financial instruction is immutable/,
  );
  await assert.rejects(
    prisma.eventOrderItem.update({ where: { id: order.items[0].id }, data: { quantity: 2 } }),
    /event order items are immutable/,
  );
  await prisma.eventOrder.update({ where: { id: order.id }, data: { status: 'FUNDS_RESERVED' } });
  await prisma.financialTransaction.update({ where: { id: financial.id }, data: { status: 'AUTHORIZED' } });
  await prisma.financialTransaction.update({ where: { id: financial.id }, data: { status: 'FUNDS_RESERVED' } });
  const buyerLiability = await prisma.ledgerAccount.create({
    data: { code: `event-buyer-liability-${suffix}`, name: 'Event buyer wallet', category: 'LIABILITY', normalBalance: 'CREDIT', currency: 'NGN', ownerUserId: user.id },
  });
  await prisma.$transaction(async (tx) => {
    const journal = await tx.journalTransaction.create({ data: { reference: `event-order-journal-${suffix}`, financialTransactionId: financial.id, currency: 'NGN' } });
    await tx.journalEntry.createMany({ data: [
      { journalTransactionId: journal.id, ledgerAccountId: buyerLiability.id, sequence: 1, side: 'DEBIT', amountMinor: 1000n },
      { journalTransactionId: journal.id, ledgerAccountId: settlement.id, sequence: 2, side: 'CREDIT', amountMinor: 1000n },
    ] });
    await tx.journalTransaction.update({ where: { id: journal.id }, data: { postedAt: new Date() } });
  });
  await prisma.financialTransaction.update({ where: { id: financial.id }, data: { status: 'SUCCEEDED' } });
  await prisma.eventOrder.update({ where: { id: order.id }, data: { status: 'PAID' } });
  await assert.rejects(
    prisma.eventOrder.update({ where: { id: order.id }, data: { status: 'REFUNDED' } }),
    /invalid event order state transition/,
  );

  const ticket = await prisma.eventTicket.create({
    data: {
      publicCode: `TWP-${suffix}`.slice(0, 100), orderId: order.id, ticketTypeId: ticketType.id,
      credentialFingerprint: 'b'.repeat(64), credentialCiphertext: 'encrypted-qr', credentialKeyVersion: 1,
    },
  });
  await assert.rejects(
    prisma.eventTicket.update({ where: { id: ticket.id }, data: { credentialCiphertext: 'rewritten' } }),
    /ticket credential\/instruction is immutable/,
  );
  const checkIn = await prisma.ticketCheckIn.create({ data: { ticketId: ticket.id, checkedInByUserId: user.id, requestId: `checkin-${suffix}`.slice(0, 64) } });
  const checkedTicket = await prisma.eventTicket.findUniqueOrThrow({ where: { id: ticket.id } });
  assert.equal(checkedTicket.status, 'CHECKED_IN');
  await assert.rejects(
    prisma.eventTicket.update({ where: { id: ticket.id }, data: { status: 'ACTIVE' } }),
    /invalid ticket state transition/,
  );
  await assert.rejects(
    prisma.ticketCheckIn.update({ where: { id: checkIn.id }, data: { requestId: 'rewritten' } }),
    /ticket check-ins are immutable/,
  );
});

test('Batch 3 organizer settlement account must be NGN credit-normal liability', async () => {
  const user = await prisma.user.create({ data: { email: `organizer-ledger-${suffix}@example.com`, status: 'ACTIVE' } });
  const wrong = await prisma.ledgerAccount.create({
    data: { code: `organizer-wrong-${suffix}`, name: 'Wrong organizer account', category: 'ASSET', normalBalance: 'DEBIT', currency: 'NGN', system: true },
  });
  await assert.rejects(
    prisma.eventOrganizer.create({
      data: { ownerUserId: user.id, name: 'Wrong Organizer', slug: `wrong-organizer-${suffix}`.slice(0, 120), settlementLedgerAccountId: wrong.id },
    }),
    /organizer settlement ledger configuration mismatch/,
  );
  const customerLiability = await prisma.ledgerAccount.create({
    data: { code: `organizer-customer-owned-${suffix}`, name: 'Customer liability', category: 'LIABILITY', normalBalance: 'CREDIT', currency: 'NGN', ownerUserId: user.id, system: false },
  });
  await assert.rejects(
    prisma.eventOrganizer.create({
      data: { ownerUserId: user.id, name: 'Customer-owned ledger organizer', slug: `customer-owned-ledger-${suffix}`.slice(0, 120), settlementLedgerAccountId: customerLiability.id },
    }),
    /organizer settlement ledger configuration mismatch/,
  );
});
