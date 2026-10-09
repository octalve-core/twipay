import { BadRequestException, Body, Controller, Get, Headers, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../platform/http/zod-validation.pipe.js';
import { SessionAuthGuard, requirePrincipal, type AuthenticatedFastifyRequest } from '../../auth/presentation/session-auth.guard.js';
import { requireMfa } from '../../auth/presentation/permission.guard.js';
import { CustomerSupportService } from '../application/customer-support.service.js';
import { DisputeRefundService } from '../application/dispute-refund.service.js';
import { OrganizerPayoutService } from '../application/organizer-payout.service.js';

const SupportOpen = z.object({category:z.enum(['GENERAL','ACCOUNT','EVENTS','TECHNICAL']),subject:z.string().trim().min(5).max(140),message:z.string().trim().min(10).max(3000),requestKey:z.uuid()}).strict();
const SupportReply = z.object({message:z.string().trim().min(2).max(3000),requestKey:z.uuid()}).strict();
const SupportRef=z.string().regex(/^sup_[0-9a-f-]{36}$/);
const DisputeSchema = z.object({ financialReference: z.string().min(6).max(100), category: z.string().regex(/^[A-Z0-9_]{3,80}$/), reasonCode: z.string().regex(/^[A-Z0-9_]{3,80}$/), details: z.string().trim().min(10).max(5000) }).strict();
const RefundRequestSchema = z.object({ reasonCode: z.string().regex(/^[A-Z0-9_]{3,80}$/), details: z.string().trim().min(10).max(5000) }).strict();
const ProviderSchema = z.enum(['paystack','monnify']);
const PayoutRequestSchema = z.object({ provider: ProviderSchema, amountMinor: z.string().regex(/^[1-9]\d{0,15}$/), bankCode: z.string().trim().min(2).max(20), accountNumber: z.string().regex(/^\d{10}$/), narration: z.string().trim().min(3).max(120) }).strict();
function idem(value: string|undefined): string { if (!value) throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED' }); return value; }

@ApiTags('customer-operations')
@UseGuards(SessionAuthGuard)
@Controller()
export class CustomerOperationsController {
  constructor(private readonly disputes: DisputeRefundService, private readonly payouts: OrganizerPayoutService, private readonly support:CustomerSupportService) {}

  @Post('support/cases') async openSupport(@Body(new ZodValidationPipe(SupportOpen)) body:z.infer<typeof SupportOpen>,@Req() req:AuthenticatedFastifyRequest){ const p=requirePrincipal(req);return {case:await this.support.create({userId:p.userId,...body})}; }
  @Get('support/cases') async mySupport(@Req() req:AuthenticatedFastifyRequest){return {cases:await this.support.listForCustomer(requirePrincipal(req).userId)};}
  @Get('support/cases/:reference') async supportDetail(@Param('reference',new ZodValidationPipe(SupportRef)) reference:string,@Req() req:AuthenticatedFastifyRequest){return {case:await this.support.customerDetail(requirePrincipal(req).userId,reference)};}
  @Post('support/cases/:reference/replies') async supportReply(@Param('reference',new ZodValidationPipe(SupportRef)) reference:string,@Body(new ZodValidationPipe(SupportReply)) body:z.infer<typeof SupportReply>,@Req() req:AuthenticatedFastifyRequest){return {case:await this.support.customerReply({userId:requirePrincipal(req).userId,reference,...body})};}

  @Post('disputes')
  async createDispute(@Body(new ZodValidationPipe(DisputeSchema)) body: z.infer<typeof DisputeSchema>, @Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    const dispute = await this.disputes.createDispute({ userId: principal.userId, ...body });
    return { dispute: { reference: dispute.reference, status: dispute.status, category: dispute.category, reasonCode: dispute.reasonCode, openedAt: dispute.openedAt } };
  }

  @Get('disputes')
  async listDisputes(@Req() req: AuthenticatedFastifyRequest) { const principal = requirePrincipal(req); return { disputes: await this.disputes.listUserDisputes(principal.userId) }; }

  @Post('events/orders/:reference/refund-requests')
  async requestRefund(@Param('reference') reference: string, @Body(new ZodValidationPipe(RefundRequestSchema)) body: z.infer<typeof RefundRequestSchema>, @Headers('idempotency-key') key: string|undefined, @Req() req: AuthenticatedFastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const principal = requirePrincipal(req);
    const result = await this.disputes.requestEventRefund({ userId: principal.userId, orderReference: reference, reasonCode: body.reasonCode, details: body.details, idempotencyKey: idem(key) });
    res.status(result.statusCode); return result.body;
  }

  @Post('events/organizers/:organizerId/payouts')
  async requestPayout(@Param('organizerId') organizerId: string, @Body(new ZodValidationPipe(PayoutRequestSchema)) body: z.infer<typeof PayoutRequestSchema>, @Headers('idempotency-key') key: string|undefined, @Req() req: AuthenticatedFastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    requireMfa(req);
    const principal = requirePrincipal(req);
    const result = await this.payouts.request({ ownerUserId: principal.userId, sessionId: principal.sessionId, organizerId, providerCode: body.provider, amountMinor: BigInt(body.amountMinor), bankCode: body.bankCode, accountNumber: body.accountNumber, narration: body.narration, idempotencyKey: idem(key) });
    res.status(result.statusCode); return result.body;
  }

  @Get('events/organizers/:organizerId/payouts')
  async organizerPayouts(@Param('organizerId') organizerId: string, @Req() req: AuthenticatedFastifyRequest) { const principal = requirePrincipal(req); return { payouts: await this.payouts.listForOrganizer(principal.userId, organizerId) }; }
}
