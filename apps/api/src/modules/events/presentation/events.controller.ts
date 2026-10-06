import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../platform/http/zod-validation.pipe.js';
import { SessionAuthGuard, requirePrincipal, type AuthenticatedFastifyRequest } from '../../auth/presentation/session-auth.guard.js';
import { EventService } from '../application/event.service.js';

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
const CheckoutSchema = z.object({
  eventId: z.uuid(),
  items: z.array(z.object({ ticketTypeId: z.uuid(), quantity: z.number().int().min(1).max(20) }).strict()).min(1).max(10),
  issuedToName: z.string().trim().min(2).max(180).optional(),
}).strict();
const CheckInSchema = z.object({ qrPayload: z.string().min(60).max(300), requestId: z.string().trim().min(8).max(64).optional() }).strict();

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
  constructor(private readonly events: EventService) {}

  @Get()
  async list() {
    const events = await this.events.listPublished();
    return { events: events.map(serializeEvent) };
  }

  @Get(':slug')
  async one(@Param('slug') slug: string) {
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

  @Post('checkout')
  @UseGuards(SessionAuthGuard)
  async checkout(
    @Body(new ZodValidationPipe(CheckoutSchema)) body: z.infer<typeof CheckoutSchema>,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() req: AuthenticatedFastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const principal = requirePrincipal(req);
    const result = await this.events.checkout({
      userId: principal.userId, idempotencyKey: requireIdempotencyKey(idempotencyKey), eventId: body.eventId, items: body.items,
      ...(body.issuedToName ? { issuedToName: body.issuedToName } : {}),
    });
    res.status(result.statusCode);
    return result.body;
  }

  @Get('orders/:reference')
  @UseGuards(SessionAuthGuard)
  async order(@Param('reference') reference: string, @Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    return { order: await this.events.getOrderForUser(principal.userId, reference) };
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
