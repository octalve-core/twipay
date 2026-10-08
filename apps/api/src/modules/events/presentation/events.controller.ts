import { BadRequestException, Body, Controller, Delete, Get, Headers, NotFoundException, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../platform/http/zod-validation.pipe.js';
import { SessionAuthGuard, requirePrincipal, type AuthenticatedFastifyRequest } from '../../auth/presentation/session-auth.guard.js';
import { EventService } from '../application/event.service.js';
import { ProductConfigService } from '../../product/application/product-config.service.js';

const Slug = z.string().trim().min(3).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const DateTime = z.string().refine((value) => Number.isFinite(Date.parse(value)), 'invalid datetime');
const OrganizerSchema = z.object({ name: z.string().trim().min(2).max(180), slug: Slug }).strict();
const EventSchema = z.object({
  organizerId: z.uuid(), slug: Slug, title: z.string().trim().min(3).max(220), description: z.string().trim().max(10_000).optional(),
  venueName: z.string().trim().max(220).optional(), venueAddress: z.string().trim().max(500).optional(),
  startsAt: DateTime, endsAt: DateTime.optional(), salesStartsAt: DateTime.optional(), salesEndsAt: DateTime.optional(),
}).strict();
const TicketTypeSchema = z.object({
  name: z.string().trim().min(2).max(160), priceMinor: z.string().regex(/^[1-9]\d{0,17}$/), capacity: z.number().int().min(1).max(1_000_000),
  salesStartsAt: DateTime.optional(), salesEndsAt: DateTime.optional(),
}).strict();
const QuoteSchema = z.object({
  eventId: z.uuid(),
  items: z.array(z.object({ ticketTypeId: z.uuid(), quantity: z.number().int().min(1).max(20) }).strict()).min(1).max(10),
}).strict();
const CheckoutSchema = z.object({
  eventId: z.uuid(),
  items: z.array(z.object({ ticketTypeId: z.uuid(), quantity: z.number().int().min(1).max(20) }).strict()).min(1).max(10),
  issuedToName: z.string().trim().min(2).max(180).optional(),
  expectedTotalMinor: z.string().regex(/^[1-9]\d{0,18}$/),
}).strict();
const CheckInSchema = z.object({ qrPayload: z.string().min(60).max(300), requestId: z.string().trim().min(8).max(64).optional() }).strict();
const StaffSchema = z.object({ email: z.email().max(320) }).strict();

function requireIdempotencyKey(value: string | undefined): string {
  if (!value) throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  return value;
}
function iso(value?: string): Date | undefined { return value ? new Date(value) : undefined; }
function serializeEvent(event: {
  id: string; slug: string; title: string; description: string | null; status: string; venueName: string | null; venueAddress: string | null;
  startsAt: Date; endsAt: Date | null; salesStartsAt: Date | null; salesEndsAt: Date | null;
  organizer: { name: string; slug: string }; ticketTypes: Array<{ id: string; name: string; priceMinor: bigint; currency: string; capacity: number; status: string }>;
}) {
  return {
    id: event.id, slug: event.slug, title: event.title, description: event.description, status: event.status,
    venueName: event.venueName, venueAddress: event.venueAddress, startsAt: event.startsAt, endsAt: event.endsAt,
    salesStartsAt: event.salesStartsAt, salesEndsAt: event.salesEndsAt, organizer: event.organizer,
    ticketTypes: event.ticketTypes.map((ticket) => ({ ...ticket, priceMinor: ticket.priceMinor.toString() })),
  };
}

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventService, private readonly product: ProductConfigService) {}

  @Get()
  async list() {
    await this.product.assertFeatureEnabled('events.marketplace', true);
    const events = await this.events.listPublished();
    return { events: events.map(serializeEvent) };
  }

  @Get(':slug')
  async one(@Param('slug') slug: string) {
    await this.product.assertFeatureEnabled('events.marketplace', true);
    const event = await this.events.publishedBySlug(slug);
    return { event: event ? serializeEvent(event) : null };
  }

  @Post('organizers')
  @UseGuards(SessionAuthGuard)
  async organizer(@Body(new ZodValidationPipe(OrganizerSchema)) body: z.infer<typeof OrganizerSchema>, @Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    return { organizer: await this.events.createOrganizer({ ownerUserId: principal.userId, name: body.name, slug: body.slug }) };
  }

  @Post()
  @UseGuards(SessionAuthGuard)
  async create(@Body(new ZodValidationPipe(EventSchema)) body: z.infer<typeof EventSchema>, @Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    return { event: await this.events.createEvent({
      ownerUserId: principal.userId, organizerId: body.organizerId, slug: body.slug, title: body.title,
      ...(body.description ? { description: body.description } : {}), ...(body.venueName ? { venueName: body.venueName } : {}),
      ...(body.venueAddress ? { venueAddress: body.venueAddress } : {}), startsAt: new Date(body.startsAt),
      ...(iso(body.endsAt) ? { endsAt: iso(body.endsAt)! } : {}), ...(iso(body.salesStartsAt) ? { salesStartsAt: iso(body.salesStartsAt)! } : {}),
      ...(iso(body.salesEndsAt) ? { salesEndsAt: iso(body.salesEndsAt)! } : {}),
    }) };
  }

  @Post(':eventId/ticket-types')
  @UseGuards(SessionAuthGuard)
  async ticketType(
    @Param('eventId') eventId: string,
    @Body(new ZodValidationPipe(TicketTypeSchema)) body: z.infer<typeof TicketTypeSchema>,
    @Req() req: AuthenticatedFastifyRequest,
  ) {
    const principal = requirePrincipal(req);
    const ticket = await this.events.createTicketType({
      ownerUserId: principal.userId, eventId, name: body.name, priceMinor: BigInt(body.priceMinor), capacity: body.capacity,
      ...(iso(body.salesStartsAt) ? { salesStartsAt: iso(body.salesStartsAt)! } : {}),
      ...(iso(body.salesEndsAt) ? { salesEndsAt: iso(body.salesEndsAt)! } : {}),
    });
    return { ticketType: { ...ticket, priceMinor: ticket.priceMinor.toString() } };
  }

  @Post(':eventId/publish')
  @UseGuards(SessionAuthGuard)
  async publish(@Param('eventId') eventId: string, @Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    return { event: await this.events.publish(principal.userId, eventId) };
  }

  /** Server-calculated exact quote. Not a reservation; checkout revalidates pricing and capacity. */
  @Post('quote')
  @UseGuards(SessionAuthGuard)
  async quote(@Body(new ZodValidationPipe(QuoteSchema)) body: z.infer<typeof QuoteSchema>) {
    await this.product.assertFeatureEnabled('events.marketplace', true);
    return { quote: await this.events.quoteCheckout(body.eventId, body.items) };
  }

  @Post('checkout')
  @UseGuards(SessionAuthGuard)
  async checkout(
    @Body(new ZodValidationPipe(CheckoutSchema)) body: z.infer<typeof CheckoutSchema>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: AuthenticatedFastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    await this.product.assertFeatureEnabled('events.marketplace', true);
    // A feature flag exposed through the browser must never authorize a financial debit.
    if (process.env['NODE_ENV'] === 'production' || process.env['EVENT_CHECKOUT_SANDBOX_ENABLED'] !== 'true') {
      throw new BadRequestException({ code: 'EVENT_CHECKOUT_NOT_QUALIFIED' });
    }
    const principal = requirePrincipal(req);
    const result = await this.events.checkout({
      userId: principal.userId, idempotencyKey: requireIdempotencyKey(idempotencyKey), eventId: body.eventId, items: body.items,
      ...(body.issuedToName ? { issuedToName: body.issuedToName } : {}),
      expectedTotalMinor: body.expectedTotalMinor,
    });
    res.status(result.statusCode);
    return result.body;
  }


  @Get('checkout-intents/:key')
  @UseGuards(SessionAuthGuard)
  async checkoutIntent(@Param('key') key: string, @Req() req: AuthenticatedFastifyRequest) {
    if (!/^twipay-event:[0-9a-f-]{36}$/.test(key)) throw new BadRequestException({ code: 'EVENT_INTENT_KEY_INVALID' });
    const principal = requirePrincipal(req);
    return { intent: await this.events.checkoutIntentStatus(principal.userId, key) };
  }

  @Get('orders')
  @UseGuards(SessionAuthGuard)
  async orders(@Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    return { orders: await this.events.listOrdersForUser(principal.userId) };
  }

  @Get('organizers/me')
  @UseGuards(SessionAuthGuard)
  async myOrganizers(@Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    return { organizers: await this.events.listOrganizersForUser(principal.userId) };
  }

  @Get('organizers/:organizerId/events')
  @UseGuards(SessionAuthGuard)
  async organizerEvents(@Param('organizerId') organizerId: string, @Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    return { events: await this.events.listOrganizerEvents(principal.userId, organizerId) };
  }

  @Get('orders/:reference')
  @UseGuards(SessionAuthGuard)
  async order(@Param('reference') reference: string, @Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    return { order: await this.events.getOrderForUser(principal.userId, reference) };
  }


  /** Never cache or log ticket bearer credentials; ticket display stays sandbox-only until QR verification. */
  @Get('orders/:reference/tickets/:publicCode/credential')
  @UseGuards(SessionAuthGuard)
  async ticketCredential(
    @Param('reference') reference: string,
    @Param('publicCode') publicCode: string,
    @Req() req: AuthenticatedFastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    if (process.env['NODE_ENV'] === 'production' || process.env['EVENT_TICKET_QR_SANDBOX_ENABLED'] !== 'true') {
      throw new NotFoundException({ code: 'EVENT_TICKET_QR_NOT_QUALIFIED' });
    }
    if (!/^[A-Za-z0-9._:-]{1,100}$/.test(reference) || !/^TWP-[A-Za-z0-9_-]{8,100}$/.test(publicCode)) {
      throw new NotFoundException({ code: 'EVENT_TICKET_NOT_FOUND' });
    }
    const principal = requirePrincipal(req);
    const ticket = await this.events.getTicketCredentialForUser(principal.userId, reference, publicCode);
    res.header('Cache-Control', 'no-store, private, max-age=0');
    res.header('Pragma', 'no-cache');
    res.header('Referrer-Policy', 'no-referrer');
    return { ticket };
  }

  @Post(':eventId/staff')
  @UseGuards(SessionAuthGuard)
  async assignStaff(@Param('eventId') eventId: string, @Body(new ZodValidationPipe(StaffSchema)) body: z.infer<typeof StaffSchema>, @Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    return { assignment: await this.events.assignCheckInStaff({ ownerUserId: principal.userId, eventId, staffEmail: body.email }) };
  }

  @Get(':eventId/staff')
  @UseGuards(SessionAuthGuard)
  async eventStaff(@Param('eventId') eventId: string, @Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    return { assignments: await this.events.listEventStaff(principal.userId, eventId) };
  }

  @Delete(':eventId/staff/:assignmentId')
  @UseGuards(SessionAuthGuard)
  async revokeStaff(@Param('eventId') eventId: string, @Param('assignmentId') assignmentId: string, @Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    return { assignment: await this.events.revokeEventStaff({ ownerUserId: principal.userId, eventId, assignmentId }) };
  }

  @Post('tickets/check-in')
  @UseGuards(SessionAuthGuard)
  async checkIn(@Body(new ZodValidationPipe(CheckInSchema)) body: z.infer<typeof CheckInSchema>, @Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    return { ticket: await this.events.checkIn({ staffUserId: principal.userId, qrPayload: body.qrPayload, ...(body.requestId ? { requestId: body.requestId } : {}) }) };
  }

  @Get('organizers/:organizerId/settlement')
  @UseGuards(SessionAuthGuard)
  async settlement(@Param('organizerId') organizerId: string, @Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    return { settlement: await this.events.organizerSettlement(principal.userId, organizerId) };
  }
}
