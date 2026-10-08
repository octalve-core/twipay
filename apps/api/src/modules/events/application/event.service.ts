import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { JsonObject } from '@twipay/contracts';
import {
  assertCapacityAvailable,
  assertEventTransition,
  calculatePlatformFeeMinor,
  calculateSettlement,
  createTicketCredential,
  extractTicketPublicCode,
  parseAndVerifyTicketCredential,
} from '@twipay/events';
import { decryptSensitiveString, encryptSensitiveString } from '@twipay/security';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { FinancialTransactionService } from '../../finance/application/financial-transaction.service.js';
import { IdempotencyService } from '../../finance/application/idempotency.service.js';
import { LedgerService } from '../../finance/application/ledger.service.js';
import { createFinancialReference } from '../../finance/application/reference.js';
import { WalletService } from '../../finance/application/wallet.service.js';
import { NotificationService } from '../../notifications/application/notification.service.js';

function eventFeeBps(): number {
  const value = Number(process.env['EVENT_PLATFORM_FEE_BPS'] ?? '0');
  if (!Number.isInteger(value) || value < 0 || value > 5_000) throw new Error('INVALID_EVENT_PLATFORM_FEE_BPS');
  return value;
}


function ticketSigningConfig(): { currentVersion: number; keys: ReadonlyMap<number, string> } {
  const raw = process.env['TICKET_SIGNING_KEYS_JSON'];
  if (!raw) throw new Error('TICKET_SIGNING_KEYS_JSON_REQUIRED');
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error('TICKET_SIGNING_KEYS_JSON_INVALID'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('TICKET_SIGNING_KEYS_JSON_INVALID');
  const keys = new Map<number, string>();
  for (const [versionText, key] of Object.entries(parsed as Record<string, unknown>)) {
    const version = Number(versionText);
    if (!Number.isInteger(version) || version < 1 || typeof key !== 'string' || key.length < 32) throw new Error('TICKET_SIGNING_KEYS_JSON_INVALID');
    keys.set(version, key);
  }
  const currentVersion = Number(process.env['TICKET_SIGNING_CURRENT_VERSION'] ?? '1');
  if (!Number.isInteger(currentVersion) || !keys.has(currentVersion)) throw new Error('TICKET_SIGNING_CURRENT_VERSION_NOT_CONFIGURED');
  return { currentVersion, keys };
}

function orderExpiryMinutes(): number {
  const value = Number(process.env['EVENT_ORDER_EXPIRY_MINUTES'] ?? '10');
  if (!Number.isInteger(value) || value < 1 || value > 60) throw new Error('INVALID_EVENT_ORDER_EXPIRY_MINUTES');
  return value;
}

@Injectable()
export class EventService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyService,
    private readonly financial: FinancialTransactionService,
    private readonly wallets: WalletService,
    private readonly ledger: LedgerService,
    private readonly notifications: NotificationService,
  ) {}

  async createOrganizer(input: { ownerUserId: string; name: string; slug: string }) {
    const id = randomUUID();
    return this.prisma.$transaction(async (tx) => {
      const account = await tx.ledgerAccount.create({
        data: {
          code: `event-organizer:${id}:settlement:NGN`,
          name: `${input.name} event settlement`,
          category: 'LIABILITY',
          normalBalance: 'CREDIT',
          currency: 'NGN',
          system: true,
        },
      });
      return tx.eventOrganizer.create({
        data: { id, ownerUserId: input.ownerUserId, name: input.name, slug: input.slug, settlementLedgerAccountId: account.id },
      });
    });
  }

  async createEvent(input: {
    ownerUserId: string; organizerId: string; slug: string; title: string; description?: string;
    venueName?: string; venueAddress?: string; startsAt: Date; endsAt?: Date; salesStartsAt?: Date; salesEndsAt?: Date;
  }) {
    const organizer = await this.ownedOrganizer(input.organizerId, input.ownerUserId);
    if (organizer.status !== 'ACTIVE') throw new ConflictException({ code: 'EVENT_ORGANIZER_NOT_ACTIVE' });
    if (input.endsAt && input.endsAt <= input.startsAt) throw new BadRequestException({ code: 'EVENT_END_MUST_FOLLOW_START' });
    if (input.salesEndsAt && input.salesStartsAt && input.salesEndsAt <= input.salesStartsAt) throw new BadRequestException({ code: 'EVENT_SALES_WINDOW_INVALID' });
    return this.prisma.event.create({
      data: {
        organizerId: organizer.id, slug: input.slug, title: input.title, description: input.description,
        currency: 'NGN', venueName: input.venueName, venueAddress: input.venueAddress,
        startsAt: input.startsAt, endsAt: input.endsAt, salesStartsAt: input.salesStartsAt, salesEndsAt: input.salesEndsAt,
      },
    });
  }

  async createTicketType(input: {
    ownerUserId: string; eventId: string; name: string; priceMinor: bigint; capacity: number; salesStartsAt?: Date; salesEndsAt?: Date;
  }) {
    const event = await this.prisma.event.findUnique({ where: { id: input.eventId }, include: { organizer: true } });
    if (!event) throw new NotFoundException({ code: 'EVENT_NOT_FOUND' });
    if (event.organizer.ownerUserId !== input.ownerUserId) throw new NotFoundException({ code: 'EVENT_NOT_FOUND' });
    if (event.status !== 'DRAFT' && event.status !== 'SALES_PAUSED') throw new ConflictException({ code: 'EVENT_TICKET_TYPE_CHANGE_NOT_ALLOWED' });
    if (input.priceMinor <= 0n) throw new BadRequestException({ code: 'EVENT_FREE_TICKETS_NOT_ENABLED_V1' });
    if (!Number.isInteger(input.capacity) || input.capacity < 1) throw new BadRequestException({ code: 'EVENT_CAPACITY_INVALID' });
    return this.prisma.eventTicketType.create({
      data: {
        eventId: event.id, name: input.name, priceMinor: input.priceMinor, currency: 'NGN', capacity: input.capacity,
        salesStartsAt: input.salesStartsAt, salesEndsAt: input.salesEndsAt,
      },
    });
  }

  async publish(ownerUserId: string, eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, include: { organizer: true, ticketTypes: { where: { status: 'ACTIVE' } } } });
    if (!event || event.organizer.ownerUserId !== ownerUserId) throw new NotFoundException({ code: 'EVENT_NOT_FOUND' });
    if (event.ticketTypes.length === 0) throw new ConflictException({ code: 'EVENT_REQUIRES_ACTIVE_TICKET_TYPE' });
    if (event.startsAt <= new Date()) throw new ConflictException({ code: 'EVENT_START_MUST_BE_FUTURE' });
    assertEventTransition(event.status, 'PUBLISHED');
    return this.prisma.event.update({ where: { id: event.id }, data: { status: 'PUBLISHED' } });
  }

  async listPublished() {
    return this.prisma.event.findMany({
      where: { status: { in: ['PUBLISHED', 'SOLD_OUT'] }, startsAt: { gt: new Date() } },
      include: { organizer: { select: { name: true, slug: true } }, ticketTypes: { where: { status: { in: ['ACTIVE', 'SOLD_OUT'] } } } },
      orderBy: { startsAt: 'asc' },
      take: 100,
    });
  }

  async publishedBySlug(slug: string) {
    return this.prisma.event.findFirst({
      where: { slug, status: { in: ['PUBLISHED', 'SOLD_OUT'] } },
      include: { organizer: { select: { name: true, slug: true } }, ticketTypes: { where: { status: { in: ['ACTIVE', 'SOLD_OUT'] } }, orderBy: { priceMinor: 'asc' } } },
    });
  }

  async quoteCheckout(eventId: string, rawItems: readonly { ticketTypeId: string; quantity: number }[]) {
    if (rawItems.length < 1 || rawItems.length > 10) throw new BadRequestException({ code: 'EVENT_ORDER_ITEMS_INVALID' });
    const consolidated = new Map<string, number>();
    for (const item of rawItems) consolidated.set(item.ticketTypeId, (consolidated.get(item.ticketTypeId) ?? 0) + item.quantity);
    const items = [...consolidated.entries()].map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity }));
    if (items.length < 1 || items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20)) {
      throw new BadRequestException({ code: 'EVENT_ORDER_ITEMS_INVALID' });
    }
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, include: { ticketTypes: true } });
    if (!event || event.status !== 'PUBLISHED' || event.startsAt <= new Date()) throw new NotFoundException({ code: 'EVENT_NOT_ON_SALE' });
    const now = new Date();
    if ((event.salesStartsAt && event.salesStartsAt > now) || (event.salesEndsAt && event.salesEndsAt <= now)) throw new ConflictException({ code: 'EVENT_NOT_ON_SALE' });
    let subtotalMinor = 0n;
    for (const item of items) {
      const type = event.ticketTypes.find((ticket) => ticket.id === item.ticketTypeId);
      if (!type || type.status !== 'ACTIVE' || type.currency !== 'NGN' || type.priceMinor <= 0n) throw new ConflictException({ code: 'EVENT_TICKET_TYPE_NOT_AVAILABLE' });
      if ((type.salesStartsAt && type.salesStartsAt > now) || (type.salesEndsAt && type.salesEndsAt <= now)) throw new ConflictException({ code: 'EVENT_TICKET_SALES_NOT_AVAILABLE' });
      const sold = await this.prisma.eventTicket.count({ where: { ticketTypeId: type.id, status: { in: ['ACTIVE', 'CHECKED_IN'] } } });
      assertCapacityAvailable(type.capacity, sold, item.quantity);
      subtotalMinor += type.priceMinor * BigInt(item.quantity);
    }
    const platformFeeMinor = calculatePlatformFeeMinor(subtotalMinor, eventFeeBps());
    if (subtotalMinor + platformFeeMinor > 9_223_372_036_854_775_807n) throw new BadRequestException({ code: 'EVENT_TOTAL_OUT_OF_RANGE' });
    return { eventId, currency: 'NGN', items, subtotalMinor: subtotalMinor.toString(), platformFeeMinor: platformFeeMinor.toString(), totalMinor: (subtotalMinor + platformFeeMinor).toString() };
  }

  async checkout(input: {
    userId: string; idempotencyKey: string; eventId: string;
    items: readonly { ticketTypeId: string; quantity: number }[]; issuedToName?: string; expectedTotalMinor: string;
  }): Promise<{ statusCode: number; body: JsonObject }> {
    const consolidated = new Map<string, number>();
    for (const item of input.items) consolidated.set(item.ticketTypeId, (consolidated.get(item.ticketTypeId) ?? 0) + item.quantity);
    const items = [...consolidated.entries()].map(([ticketTypeId, quantity]) => ({ ticketTypeId, quantity }));
    if (items.length < 1 || items.length > 10 || items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20)) {
      throw new BadRequestException({ code: 'EVENT_ORDER_ITEMS_INVALID' });
    }
    const idem = await this.idempotency.begin({ scope: 'event:checkout', key: input.idempotencyKey, userId: input.userId, request: { eventId: input.eventId, items, issuedToName: input.issuedToName, expectedTotalMinor: input.expectedTotalMinor } });
    if (idem.replay) return { statusCode: idem.replay.status, body: idem.replay.body };
    const idemId = idem.recordId!;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const event = await tx.event.findUnique({ where: { id: input.eventId }, include: { organizer: true } });
        if (!event || !['PUBLISHED', 'SOLD_OUT'].includes(event.status)) throw new NotFoundException({ code: 'EVENT_NOT_ON_SALE' });
        if (event.status === 'SOLD_OUT') throw new ConflictException({ code: 'EVENT_SOLD_OUT' });
        const now = new Date();
        if (event.salesStartsAt && event.salesStartsAt > now) throw new ConflictException({ code: 'EVENT_SALES_NOT_STARTED' });
        if (event.salesEndsAt && event.salesEndsAt <= now) throw new ConflictException({ code: 'EVENT_SALES_ENDED' });
        if (event.startsAt <= now) throw new ConflictException({ code: 'EVENT_ALREADY_STARTED' });

        for (const item of [...items].sort((a, b) => a.ticketTypeId.localeCompare(b.ticketTypeId))) {
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${item.ticketTypeId}, 0))`;
        }
        const ticketTypes = await tx.eventTicketType.findMany({ where: { id: { in: items.map((item) => item.ticketTypeId) }, eventId: event.id } });
        if (ticketTypes.length !== items.length) throw new BadRequestException({ code: 'EVENT_TICKET_TYPE_INVALID' });

        let subtotalMinor = 0n;
        const itemRows: Array<{ ticketTypeId: string; quantity: number; unitPriceMinor: bigint; lineTotalMinor: bigint }> = [];
        for (const item of items) {
          const ticketType = ticketTypes.find((candidate) => candidate.id === item.ticketTypeId)!;
          if (ticketType.status !== 'ACTIVE') throw new ConflictException({ code: 'EVENT_TICKET_TYPE_NOT_AVAILABLE' });
          if (ticketType.currency !== 'NGN' || ticketType.priceMinor <= 0n) throw new Error('EVENT_TICKET_TYPE_FINANCIAL_CONFIGURATION_INVALID');
          if (ticketType.salesStartsAt && ticketType.salesStartsAt > now) throw new ConflictException({ code: 'EVENT_TICKET_SALES_NOT_STARTED' });
          if (ticketType.salesEndsAt && ticketType.salesEndsAt <= now) throw new ConflictException({ code: 'EVENT_TICKET_SALES_ENDED' });
          const sold = await tx.eventTicket.count({ where: { ticketTypeId: ticketType.id, status: { in: ['ACTIVE', 'CHECKED_IN'] } } });
          assertCapacityAvailable(ticketType.capacity, sold, item.quantity);
          const lineTotalMinor = ticketType.priceMinor * BigInt(item.quantity);
          subtotalMinor += lineTotalMinor;
          itemRows.push({ ticketTypeId: ticketType.id, quantity: item.quantity, unitPriceMinor: ticketType.priceMinor, lineTotalMinor });
        }

        const platformFeeMinor = calculatePlatformFeeMinor(subtotalMinor, eventFeeBps());
        const totalMinor = subtotalMinor + platformFeeMinor;
        if (totalMinor > 9_223_372_036_854_775_807n) throw new BadRequestException({ code: 'EVENT_TOTAL_OUT_OF_RANGE' });
        // The customer must explicitly approve the final quoted total before funds are reserved.
        if (totalMinor.toString() !== input.expectedTotalMinor) throw new ConflictException({ code: 'EVENT_QUOTE_CHANGED' });
        const settlement = calculateSettlement({ grossMinor: totalMinor, platformFeeMinor });
        if (settlement.organizerMinor !== subtotalMinor) throw new Error('EVENT_SETTLEMENT_CALCULATION_MISMATCH');

        const wallet = await this.wallets.ensureUserWalletWithTx(tx, input.userId, 'NGN');
        const reference = createFinancialReference('evt');
        const financial = await this.financial.createWithTx(tx, {
          reference, userId: input.userId, type: 'EVENT_PURCHASE', currency: 'NGN', amountMinor: totalMinor,
          feeMinor: platformFeeMinor, description: `Event ticket purchase: ${event.title}`,
        });
        await this.financial.transitionWithTx(tx, financial.id, 'AUTHORIZED', 'EVENT_ORDER_AUTHORIZED');
        const order = await tx.eventOrder.create({
          data: {
            reference, userId: input.userId, eventId: event.id, financialTransactionId: financial.id,
            subtotalMinor, platformFeeMinor, totalMinor, currency: 'NGN',
            expiresAt: new Date(now.getTime() + orderExpiryMinutes() * 60_000),
            items: { create: itemRows },
          },
        });
        const hold = await this.wallets.reserveWithTx(tx, { userId: input.userId, walletId: wallet.id, financialTransactionId: financial.id, amountMinor: totalMinor });
        await this.financial.transitionWithTx(tx, financial.id, 'FUNDS_RESERVED', 'EVENT_FUNDS_RESERVED');
        await tx.eventOrder.update({ where: { id: order.id }, data: { status: 'FUNDS_RESERVED' } });

        const feeAccount = platformFeeMinor > 0n ? await this.wallets.systemAccountWithTx(tx, {
          code: 'event-platform-fee-revenue', name: 'Event platform fee revenue', category: 'REVENUE', normalBalance: 'CREDIT', currency: 'NGN',
        }) : null;
        const entries: Array<{ accountId: string; side: 'DEBIT' | 'CREDIT'; amountMinor: bigint; memo?: string }> = [
          { accountId: wallet.ledgerAccountId, side: 'DEBIT', amountMinor: totalMinor, memo: `Event order ${reference}` },
          { accountId: event.organizer.settlementLedgerAccountId, side: 'CREDIT', amountMinor: subtotalMinor, memo: `Organizer settlement ${reference}` },
        ];
        if (feeAccount && platformFeeMinor > 0n) entries.push({ accountId: feeAccount.id, side: 'CREDIT', amountMinor: platformFeeMinor, memo: `Platform fee ${reference}` });
        await this.ledger.postWithTx(tx, { reference: `jrn:${reference}:event`, financialTransactionId: financial.id, currency: 'NGN', description: 'Wallet-funded event ticket settlement', entries });
        await this.wallets.captureHoldWithTx(tx, hold.id);
        await this.financial.settleInternalEventPurchaseWithTx(tx, financial.id);
        await tx.eventOrder.update({ where: { id: order.id }, data: { status: 'PAID', paidAt: new Date() } });

        const user = await tx.user.findUniqueOrThrow({ where: { id: input.userId }, select: { email: true } });
        const ticketSigning = ticketSigningConfig();
        const ticketSigningKey = ticketSigning.keys.get(ticketSigning.currentVersion)!;
        const issued: Array<{ id: string; publicCode: string; qrPayload: string; ticketTypeId: string }> = [];
        for (const item of itemRows) {
          for (let index = 0; index < item.quantity; index += 1) {
            const publicCode = `TWP-${randomUUID().replaceAll('-', '').slice(0, 24)}`;
            const credential = createTicketCredential(publicCode, ticketSigningKey);
            const ticket = await tx.eventTicket.create({
              data: {
                publicCode,
                orderId: order.id,
                ticketTypeId: item.ticketTypeId,
                credentialFingerprint: credential.fingerprint,
                credentialCiphertext: encryptSensitiveString(credential.qrPayload, process.env['DATA_ENCRYPTION_KEY']!),
                credentialKeyVersion: ticketSigning.currentVersion,
                issuedToName: input.issuedToName,
                issuedToEmail: user.email,
              },
            });
            issued.push({ id: ticket.id, publicCode, qrPayload: credential.qrPayload, ticketTypeId: item.ticketTypeId });
          }
        }
        const body: JsonObject = {
          reference: order.reference,
          status: 'PAID',
          eventId: event.id,
          eventTitle: event.title,
          subtotalMinor: order.subtotalMinor.toString(),
          platformFeeMinor: order.platformFeeMinor.toString(),
          totalMinor: order.totalMinor.toString(),
          currency: order.currency,
          tickets: issued.map((ticket) => ({ publicCode: ticket.publicCode, ticketTypeId: ticket.ticketTypeId, qrPayload: ticket.qrPayload })),
        };
        await this.idempotency.attachResourceWithTx(tx, idemId, 'event_order', order.id);
        await this.idempotency.completeWithTx(tx, idemId, 201, body);
        await this.notifications.enqueueWithTx(tx, {
          userId: input.userId,
          channel: 'EMAIL',
          templateCode: 'EVENT_TICKETS_ISSUED',
          destination: user.email,
          subject: `Your ${event.title} tickets`,
          text: `Your TwiPay event order ${order.reference} is paid. Open TwiPay to view your ticket QR code(s).`,
          idempotencyKey: `event-order:${order.id}:receipt`,
        });
        return { body };
      }, { isolationLevel: 'Serializable' });
      return { statusCode: 201, body: result.body };
    } catch (error) {
      await this.idempotency.fail(idemId, 409, { code: error instanceof Error ? error.name : 'EVENT_CHECKOUT_REJECTED' });
      throw error;
    }
  }


  /** Resumable read-only status for uncertain checkout attempts; never returns encrypted ticket credentials. */
  async checkoutIntentStatus(userId: string, key: string) {
    const record = await this.prisma.idempotencyRecord.findUnique({ where: { userId_scope_key: { userId, scope: 'event:checkout', key } }, select: { status: true, expiresAt: true, resourceType: true, resourceId: true } });
    if (!record || record.expiresAt <= new Date()) return { status: 'NOT_FOUND' as const };
    if (record.status === 'PROCESSING') return { status: 'PROCESSING' as const };
    if (record.status === 'FAILED') return { status: 'FAILED' as const };
    if (record.resourceType !== 'event_order' || !record.resourceId) return { status: 'UNKNOWN' as const };
    const order = await this.prisma.eventOrder.findFirst({ where: { id: record.resourceId, userId }, select: { reference: true, status: true } });
    if (!order) return { status: 'UNKNOWN' as const };
    return { status: order.status, reference: order.reference };
  }

  async listOrdersForUser(userId: string) {
    const orders = await this.prisma.eventOrder.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, take: 100,
      include: { event: { select: { title: true, slug: true, startsAt: true, venueName: true } }, tickets: { select: { publicCode: true, status: true, ticketType: { select: { name: true } } } } },
    });
    return orders.map((order) => ({
      reference: order.reference, status: order.status, event: order.event,
      subtotalMinor: order.subtotalMinor.toString(), platformFeeMinor: order.platformFeeMinor.toString(), totalMinor: order.totalMinor.toString(), currency: order.currency,
      paidAt: order.paidAt, createdAt: order.createdAt,
      tickets: order.tickets.map((ticket) => ({ publicCode: ticket.publicCode, status: ticket.status, ticketType: ticket.ticketType.name })),
    }));
  }

  async listOrganizersForUser(ownerUserId: string) {
    const organizers = await this.prisma.eventOrganizer.findMany({
      where: { ownerUserId }, orderBy: { createdAt: 'desc' }, take: 50,
      include: { _count: { select: { events: true } } },
    });
    return Promise.all(organizers.map(async (organizer) => ({
      id: organizer.id, name: organizer.name, slug: organizer.slug, status: organizer.status, eventCount: organizer._count.events,
      settlement: await this.organizerSettlement(ownerUserId, organizer.id),
    })));
  }

  async listOrganizerEvents(ownerUserId: string, organizerId: string) {
    await this.ownedOrganizer(organizerId, ownerUserId);
    const events = await this.prisma.event.findMany({
      where: { organizerId }, orderBy: { startsAt: 'desc' }, take: 100,
      include: { ticketTypes: true, _count: { select: { orders: true } } },
    });
    return events.map((event) => ({ ...event, ticketTypes: event.ticketTypes.map((ticket) => ({ ...ticket, priceMinor: ticket.priceMinor.toString() })), orderCount: event._count.orders }));
  }

  async getOrderForUser(userId: string, reference: string): Promise<JsonObject | null> {
    const order = await this.prisma.eventOrder.findFirst({
      where: { userId, reference },
      include: { event: true, items: { include: { ticketType: true } }, tickets: true },
    });
    if (!order) return null;
    return {
      reference: order.reference, status: order.status, eventId: order.eventId, eventTitle: order.event.title,
      subtotalMinor: order.subtotalMinor.toString(), platformFeeMinor: order.platformFeeMinor.toString(), totalMinor: order.totalMinor.toString(), currency: order.currency,
      items: order.items.map((item) => ({ name: item.ticketType.name, quantity: item.quantity, unitPriceMinor: item.unitPriceMinor.toString(), lineTotalMinor: item.lineTotalMinor.toString() })),
      tickets: order.tickets.map((ticket) => ({ publicCode: ticket.publicCode, status: ticket.status, qrPayload: decryptSensitiveString(ticket.credentialCiphertext, process.env['DATA_ENCRYPTION_KEY']!) })),
    };
  }


  async assignCheckInStaff(input: { ownerUserId: string; eventId: string; staffEmail: string }) {
    const event = await this.prisma.event.findUnique({ where: { id: input.eventId }, include: { organizer: true } });
    if (!event || event.organizer.ownerUserId !== input.ownerUserId) throw new NotFoundException({ code: 'EVENT_NOT_FOUND' });
    const staff = await this.prisma.user.findUnique({ where: { email: input.staffEmail.trim().toLowerCase() }, select: { id: true, email: true, givenName: true, familyName: true, status: true } });
    if (!staff || staff.status !== 'ACTIVE') throw new NotFoundException({ code: 'EVENT_STAFF_USER_NOT_FOUND' });
    if (staff.id === input.ownerUserId) throw new ConflictException({ code: 'ORGANIZER_OWNER_ALREADY_AUTHORIZED' });
    const assignment = await this.prisma.eventStaffAssignment.upsert({
      where: { eventId_userId_role: { eventId: event.id, userId: staff.id, role: 'CHECK_IN' } },
      create: { eventId: event.id, userId: staff.id, role: 'CHECK_IN', invitedByUserId: input.ownerUserId },
      update: { status: 'ACTIVE' },
    });
    return { id: assignment.id, eventId: assignment.eventId, role: assignment.role, status: assignment.status, staff };
  }

  async listEventStaff(ownerUserId: string, eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, include: { organizer: true } });
    if (!event || event.organizer.ownerUserId !== ownerUserId) throw new NotFoundException({ code: 'EVENT_NOT_FOUND' });
    return this.prisma.eventStaffAssignment.findMany({
      where: { eventId }, orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, email: true, givenName: true, familyName: true } } },
    });
  }

  async revokeEventStaff(input: { ownerUserId: string; eventId: string; assignmentId: string }) {
    const assignment = await this.prisma.eventStaffAssignment.findUnique({ where: { id: input.assignmentId }, include: { event: { include: { organizer: true } } } });
    if (!assignment || assignment.eventId !== input.eventId || assignment.event.organizer.ownerUserId !== input.ownerUserId) throw new NotFoundException({ code: 'EVENT_STAFF_ASSIGNMENT_NOT_FOUND' });
    if (assignment.status === 'REVOKED') return assignment;
    return this.prisma.eventStaffAssignment.update({ where: { id: assignment.id }, data: { status: 'REVOKED' } });
  }

  async checkIn(input: { staffUserId: string; qrPayload: string; requestId?: string }) {
    const publicCode = extractTicketPublicCode(input.qrPayload);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "event_tickets" WHERE "publicCode" = ${publicCode} FOR UPDATE`;
      const ticket = await tx.eventTicket.findUnique({
        where: { publicCode },
        include: { order: { include: { event: { include: { organizer: true } } } }, ticketType: true, checkIn: true },
      });
      if (!ticket) throw new NotFoundException({ code: 'TICKET_NOT_FOUND' });
      const organizerOwns = ticket.order.event.organizer.ownerUserId === input.staffUserId;
      const delegated = organizerOwns ? null : await tx.eventStaffAssignment.findFirst({ where: { eventId: ticket.order.event.id, userId: input.staffUserId, role: 'CHECK_IN', status: 'ACTIVE' }, select: { id: true } });
      if (!organizerOwns && !delegated) throw new NotFoundException({ code: 'TICKET_NOT_FOUND' });
      const ticketSigning = ticketSigningConfig();
      const signingKey = ticketSigning.keys.get(ticket.credentialKeyVersion);
      if (!signingKey) throw new ConflictException({ code: 'TICKET_SIGNING_KEY_VERSION_UNAVAILABLE' });
      parseAndVerifyTicketCredential(input.qrPayload, ticket.credentialFingerprint, signingKey);
      if (ticket.status === 'CHECKED_IN' || ticket.checkIn) throw new ConflictException({ code: 'TICKET_ALREADY_CHECKED_IN', checkedInAt: ticket.checkIn?.checkedInAt });
      if (ticket.status !== 'ACTIVE') throw new ConflictException({ code: 'TICKET_NOT_ACTIVE', status: ticket.status });
      const checkIn = await tx.ticketCheckIn.create({
        data: { ticketId: ticket.id, checkedInByUserId: input.staffUserId, requestId: input.requestId },
      });
      await tx.eventTicket.update({ where: { id: ticket.id }, data: { status: 'CHECKED_IN' } });
      return { publicCode: ticket.publicCode, status: 'CHECKED_IN', checkedInAt: checkIn.checkedInAt, ticketType: ticket.ticketType.name, eventTitle: ticket.order.event.title };
    });
  }

  async organizerSettlement(ownerUserId: string, organizerId: string) {
    const organizer = await this.ownedOrganizer(organizerId, ownerUserId);
    const balanceMinor = await this.prisma.$transaction((tx) => this.ledger.accountBalanceWithTx(tx, organizer.settlementLedgerAccountId));
    return { organizerId: organizer.id, currency: 'NGN', payableBalanceMinor: balanceMinor.toString() };
  }

  private async ownedOrganizer(id: string, ownerUserId: string) {
    const organizer = await this.prisma.eventOrganizer.findFirst({ where: { id, ownerUserId } });
    if (!organizer) throw new NotFoundException({ code: 'EVENT_ORGANIZER_NOT_FOUND' });
    return organizer;
  }
}
