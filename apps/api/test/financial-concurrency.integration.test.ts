import 'reflect-metadata';
import { NestFactory, type INestApplicationContext } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/modules/app.module.js';
import { PrismaService } from '../src/platform/database/prisma.service.js';
import { WalletService } from '../src/modules/finance/application/wallet.service.js';
import { LedgerService } from '../src/modules/finance/application/ledger.service.js';
import { EventService } from '../src/modules/events/application/event.service.js';

const run = process.env['DATABASE_URL'] ? describe : describe.skip;

run('financial concurrency qualification', () => {
  let app: INestApplicationContext;
  let prisma: PrismaService;
  let wallets: WalletService;
  let ledger: LedgerService;
  let events: EventService;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  beforeAll(async () => {
    app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    prisma = app.get(PrismaService);
    wallets = app.get(WalletService);
    ledger = app.get(LedgerService);
    events = app.get(EventService);
  });
  afterAll(async () => { await app?.close(); });

  async function activeUser(label: string) {
    return prisma.user.create({ data: { email: `${label}-${suffix}@example.test`, status: 'ACTIVE' } });
  }

  async function creditWallet(userId: string, amountMinor: bigint) {
    return prisma.$transaction(async (tx) => {
      const wallet = await wallets.ensureUserWalletWithTx(tx, userId, 'NGN');
      const source = await wallets.systemAccountWithTx(tx, {
        code: `qualification-cash-${suffix}`,
        name: 'Qualification cash source',
        category: 'ASSET',
        normalBalance: 'DEBIT',
        currency: 'NGN',
      });
      await ledger.postWithTx(tx, {
        reference: `qualification-credit-${userId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        currency: 'NGN',
        description: 'Batch 5 concurrency fixture',
        entries: [
          { accountId: source.id, side: 'DEBIT', amountMinor },
          { accountId: wallet.ledgerAccountId, side: 'CREDIT', amountMinor },
        ],
      });
      return wallet;
    });
  }

  it('serializes simultaneous holds so available balance cannot be overspent', async () => {
    const user = await activeUser('wallet-race');
    const wallet = await creditWallet(user.id, 10_000n);
    const txs = await Promise.all([0, 1].map((index) => prisma.financialTransaction.create({
      data: { reference: `hold-race-${index}-${suffix}`, userId: user.id, type: 'TRANSFER', currency: 'NGN', amountMinor: 7_000n },
    })));

    const results = await Promise.allSettled(txs.map((financial) => prisma.$transaction(
      (tx) => wallets.reserveWithTx(tx, { userId: user.id, walletId: wallet.id, financialTransactionId: financial.id, amountMinor: 7_000n }),
      { isolationLevel: 'Serializable' },
    )));
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((item) => item.status === 'rejected')).toHaveLength(1);
    const active = await prisma.walletHold.aggregate({ where: { walletId: wallet.id, status: 'ACTIVE' }, _sum: { amountMinor: true } });
    expect(active._sum.amountMinor).toBe(7_000n);
  });

  it('advisory ticket-type locking prevents a last-ticket oversell', async () => {
    const owner = await activeUser('event-owner');
    const buyerA = await activeUser('event-buyer-a');
    const buyerB = await activeUser('event-buyer-b');
    // Fund sequentially so this fixture does not introduce a second, unrelated system-account race.
    await creditWallet(buyerA.id, 5_000n);
    await creditWallet(buyerB.id, 5_000n);

    const organizer = await events.createOrganizer({ ownerUserId: owner.id, name: 'Concurrency Organizer', slug: `concurrency-${suffix}`.slice(0, 120) });
    const event = await events.createEvent({ ownerUserId: owner.id, organizerId: organizer.id, slug: `race-${suffix}`.slice(0, 150), title: 'Last Ticket Race', startsAt: new Date(Date.now() + 86_400_000) });
    const ticketType = await events.createTicketType({ ownerUserId: owner.id, eventId: event.id, name: 'Only Ticket', priceMinor: 1_000n, capacity: 1 });
    await events.publish(owner.id, event.id);

    const results = await Promise.allSettled([
      events.checkout({ userId: buyerA.id, idempotencyKey: `race-a-${suffix}`, eventId: event.id, items: [{ ticketTypeId: ticketType.id, quantity: 1 }] }),
      events.checkout({ userId: buyerB.id, idempotencyKey: `race-b-${suffix}`, eventId: event.id, items: [{ ticketTypeId: ticketType.id, quantity: 1 }] }),
    ]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((item) => item.status === 'rejected')).toHaveLength(1);
    expect(await prisma.eventTicket.count({ where: { ticketTypeId: ticketType.id, status: { in: ['ACTIVE', 'CHECKED_IN'] } } })).toBe(1);
  });

  it('all posted journals remain exactly balanced after concurrent qualification', async () => {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT j."id"
      FROM "journal_transactions" j
      JOIN "journal_entries" e ON e."journalTransactionId" = j."id"
      WHERE j."postedAt" IS NOT NULL
      GROUP BY j."id"
      HAVING SUM(CASE WHEN e."side"='DEBIT' THEN e."amountMinor" ELSE 0 END)
          <> SUM(CASE WHEN e."side"='CREDIT' THEN e."amountMinor" ELSE 0 END)
    `;
    expect(rows).toEqual([]);
  });
});
