import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../platform/http/zod-validation.pipe.js';
import { PermissionGuard, RequirePermissions, requireMfa } from '../../auth/presentation/permission.guard.js';
import { SessionAuthGuard, requirePrincipal, type AuthenticatedFastifyRequest } from '../../auth/presentation/session-auth.guard.js';
import { AuditService } from '../application/audit.service.js';
import { DisputeRefundService } from '../application/dispute-refund.service.js';
import { ComplianceService } from '../application/compliance.service.js';
import { OrganizerPayoutService } from '../application/organizer-payout.service.js';
import { ProviderOperationsService } from '../application/provider-operations.service.js';
import { ReportsService } from '../application/reports.service.js';
import { FinancialExceptionService } from '../application/financial-exception.service.js';

const Reason = z.object({ reason: z.string().trim().min(5).max(500) }).strict();
const PrepareRefund = z.object({ note: z.string().trim().min(5).max(2000) }).strict();
const ExceptionReview = z.object({ note: z.string().trim().min(20).max(1200) }).strict();
const OfferControl = z.object({ active: z.boolean().optional(), priority: z.number().int().min(-100).max(100).optional(), estimatedCostMinor: z.string().regex(/^[1-9]\d{0,17}$/).nullable().optional(), reason: z.string().trim().min(5).max(500) }).strict().refine((v) => v.active !== undefined || v.priority !== undefined || v.estimatedCostMinor !== undefined, 'at least one control must change');
const Mapping = z.object({ canonicalProductId: z.uuid(), reason: z.string().trim().min(5).max(500), evidence: z.object({ source: z.string().trim().min(3).max(1000), verificationNote: z.string().trim().min(10).max(2000), verifiedProductName: z.string().trim().min(2).max(180) }).strict() }).strict();

@ApiTags('operations')
@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller('operations')
export class OperationsController {
  constructor(private readonly disputes: DisputeRefundService, private readonly payouts: OrganizerPayoutService, private readonly providers: ProviderOperationsService, private readonly reports: ReportsService, private readonly audit: AuditService, private readonly compliance: ComplianceService, private readonly exceptions: FinancialExceptionService) {}

  @Get('dashboard') @RequirePermissions('ops.dashboard.read') async dashboard() { return this.reports.dashboard(); }
  @Get('compliance') @RequirePermissions('ops.compliance.read') async complianceSnapshot() { return this.compliance.snapshot(); }
  @Get('refunds') @RequirePermissions('ops.disputes.review') async refunds() { return { refunds: await this.disputes.listRefundQueue() }; }
  @Get('disputes/:reference') @RequirePermissions('ops.disputes.review') async dispute(@Param('reference') reference: string) { return { dispute: await this.disputes.disputeDetail(reference) }; }

  @Post('refunds/:reference/prepare') @RequirePermissions('ops.refunds.prepare')
  async prepareRefund(@Param('reference') reference: string, @Body(new ZodValidationPipe(PrepareRefund)) body: z.infer<typeof PrepareRefund>, @Req() req: AuthenticatedFastifyRequest) { const p=requirePrincipal(req); return { refund: await this.disputes.prepareRefund({ reference, reviewerUserId:p.userId, note:body.note, requestId:req.id }) }; }

  @Post('refunds/:reference/reject') @RequirePermissions('ops.refunds.prepare')
  async rejectRefund(@Param('reference') reference: string, @Body(new ZodValidationPipe(Reason)) body: z.infer<typeof Reason>, @Req() req: AuthenticatedFastifyRequest) { const p=requirePrincipal(req); return { refund: await this.disputes.rejectRefund({ reference, actorUserId:p.userId, reason:body.reason, requestId:req.id }) }; }

  @Post('refunds/:reference/approve') @RequirePermissions('ops.refunds.approve')
  async approveRefund(@Param('reference') reference: string, @Req() req: AuthenticatedFastifyRequest) { requireMfa(req); const p=requirePrincipal(req); return { refund: await this.disputes.approveAndExecuteEventRefund({ reference, approverUserId:p.userId, sessionId:p.sessionId, mfaSatisfied:p.mfaSatisfied, requestId:req.id }) }; }

  @Get('payouts') @RequirePermissions('ops.dashboard.read') async payoutQueue() { return { payouts: await this.payouts.queue() }; }
  @Post('payouts/:reference/prepare') @RequirePermissions('ops.payouts.prepare')
  async preparePayout(@Param('reference') reference:string,@Req() req:AuthenticatedFastifyRequest){const p=requirePrincipal(req);return {payout:await this.payouts.prepare({reference,makerUserId:p.userId,requestId:req.id})};}
  @Post('payouts/:reference/reject') @RequirePermissions('ops.payouts.prepare')
  async rejectPayout(@Param('reference') reference:string,@Body(new ZodValidationPipe(Reason)) body:z.infer<typeof Reason>,@Req() req:AuthenticatedFastifyRequest){const p=requirePrincipal(req);return {payout:await this.payouts.reject({reference,actorUserId:p.userId,reason:body.reason,requestId:req.id})};}
  @Post('payouts/:reference/approve') @RequirePermissions('ops.payouts.approve')
  async approvePayout(@Param('reference') reference:string,@Req() req:AuthenticatedFastifyRequest){requireMfa(req);const p=requirePrincipal(req);return {payout:await this.payouts.approveAndSubmit({reference,checkerUserId:p.userId,sessionId:p.sessionId,mfaSatisfied:p.mfaSatisfied,requestId:req.id})};}
  @Post('payouts/:reference/reconcile') @RequirePermissions('ops.payouts.prepare') async reconcile(@Param('reference') reference:string,@Req() req:AuthenticatedFastifyRequest){const p=requirePrincipal(req);return {payout:await this.payouts.reconcile(reference,p.userId,req.id)};}

  @Get('financial-exceptions') @RequirePermissions('ops.reconciliation.read')
  async financialExceptions() { return this.exceptions.queue(); }

  @Post('financial-exceptions/:caseId/prepare') @RequirePermissions('ops.reconciliation.prepare')
  async prepareFinancialException(@Param('caseId') caseId: string,
    @Body(new ZodValidationPipe(ExceptionReview)) body: z.infer<typeof ExceptionReview>,
    @Req() req: AuthenticatedFastifyRequest) {
    requireMfa(req); const p = requirePrincipal(req);
    return { review: await this.exceptions.prepare({ caseId, actorUserId: p.userId, sessionId: p.sessionId,
      note: body.note, requestId: req.id }) };
  }

  @Post('financial-exceptions/:caseId/close-verified-status') @RequirePermissions('ops.reconciliation.approve')
  async closeFinancialException(@Param('caseId') caseId: string, @Req() req: AuthenticatedFastifyRequest) {
    requireMfa(req); const p = requirePrincipal(req);
    return { review: await this.exceptions.closeVerifiedStatusCase({ caseId, actorUserId: p.userId,
      sessionId: p.sessionId, requestId: req.id }) };
  }

  @Get('providers') @RequirePermissions('ops.dashboard.read') async providerSnapshot(){return this.providers.snapshot();}
  @Patch('providers/offers/:offerId') @RequirePermissions('ops.providers.manage')
  async updateOffer(@Param('offerId') offerId:string,@Body(new ZodValidationPipe(OfferControl)) body:z.infer<typeof OfferControl>,@Req() req:AuthenticatedFastifyRequest){const p=requirePrincipal(req);return {offer:await this.providers.updateOffer({offerId,actorUserId:p.userId,reason:body.reason,requestId:req.id,...(body.active!==undefined?{active:body.active}:{}),...(body.priority!==undefined?{priority:body.priority}:{}),...(body.estimatedCostMinor!==undefined?{estimatedCostMinor:body.estimatedCostMinor===null?null:BigInt(body.estimatedCostMinor)}:{})})};}
  @Post('providers/health/:healthId/reset') @RequirePermissions('ops.providers.manage')
  async resetCircuit(@Param('healthId') healthId:string,@Body(new ZodValidationPipe(Reason)) body:z.infer<typeof Reason>,@Req() req:AuthenticatedFastifyRequest){const p=requirePrincipal(req);return {health:await this.providers.resetCircuit({healthId,actorUserId:p.userId,reason:body.reason,requestId:req.id})};}
  @Post('catalog/offers/:offerId/verify-equivalence') @RequirePermissions('ops.catalog.map')
  async verifyMapping(@Param('offerId') offerId:string,@Body(new ZodValidationPipe(Mapping)) body:z.infer<typeof Mapping>,@Req() req:AuthenticatedFastifyRequest){const p=requirePrincipal(req);return {offer:await this.providers.verifyEquivalence({offerId,canonicalProductId:body.canonicalProductId,actorUserId:p.userId,evidence:body.evidence,reason:body.reason,requestId:req.id})};}

  @Get('reports') @RequirePermissions('ops.reports.read') async reportsView(){return this.reports.dashboard();}
  @Get('audit') @RequirePermissions('ops.audit.read') async auditTrail(@Query('limit') limit?:string){const parsed=Number(limit??100);return {events:await this.audit.list(Number.isFinite(parsed)?parsed:100)};}
}
