import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../platform/http/zod-validation.pipe.js';
import { PermissionGuard, RequirePermissions, requireMfa } from '../../auth/presentation/permission.guard.js';
import { SessionAuthGuard, requirePrincipal, type AuthenticatedFastifyRequest } from '../../auth/presentation/session-auth.guard.js';
import { AuditService } from '../application/audit.service.js';
import { CustomerSupportService } from '../application/customer-support.service.js';
import { DisputeRefundService } from '../application/dispute-refund.service.js';
import { ComplianceService } from '../application/compliance.service.js';
import { OrganizerPayoutService } from '../application/organizer-payout.service.js';
import { ProviderOperationsService } from '../application/provider-operations.service.js';
import { ReportsService } from '../application/reports.service.js';
import { FinancialExceptionService } from '../application/financial-exception.service.js';
import { FinancialTierReviewService } from '../application/financial-tier-review.service.js';
import { OwnerGovernanceService, DELEGABLE_STAFF_ROLES } from '../application/owner-governance.service.js';
import { ForbiddenException } from '@nestjs/common';

const SupportReply = z.object({message:z.string().trim().min(2).max(3000),requestKey:z.uuid()}).strict();
const SupportRef = z.string().regex(/^sup_[0-9a-f-]{36}$/);
const Reason = z.object({ reason: z.string().trim().min(5).max(500) }).strict();
const PrepareRefund = z.object({ note: z.string().trim().min(5).max(2000) }).strict();
const TierProposal = z.object({ tier: z.number().int().min(1).max(3),
  maxPerIntentMinor: z.string().regex(/^[1-9]\d{0,17}$/),
  maxDailyDebitMinor: z.string().regex(/^[1-9]\d{0,17}$/),
  evidenceReference: z.uuid(),
  note: z.string().trim().min(30).max(1000),
}).strict();
const UuidParam = z.uuid();
const StaffProposal = z.object({ targetUserId: z.uuid(), roleCode: z.enum(DELEGABLE_STAFF_ROLES),
  action: z.enum(['GRANT','REVOKE']), reason: z.string().trim().min(20).max(500) }).strict();
const StaffRejection = z.object({ reason: z.string().trim().min(20).max(500) }).strict();
function requireOwner(req: AuthenticatedFastifyRequest) {
  requireMfa(req);
  if (!requirePrincipal(req).roles.includes('SUPER_ADMIN')) {
    throw new ForbiddenException({ code: 'OWNER_REQUIRED' });
  }
}
const ExceptionReview = z.object({ note: z.string().trim().min(20).max(1200) }).strict();
const OfferControl = z.object({ active: z.boolean().optional(), priority: z.number().int().min(-100).max(100).optional(), estimatedCostMinor: z.string().regex(/^[1-9]\d{0,17}$/).nullable().optional(), reason: z.string().trim().min(5).max(500) }).strict().refine((v) => v.active !== undefined || v.priority !== undefined || v.estimatedCostMinor !== undefined, 'at least one control must change');
const Mapping = z.object({ canonicalProductId: z.uuid(), reason: z.string().trim().min(5).max(500), evidence: z.object({ source: z.string().trim().min(3).max(1000), verificationNote: z.string().trim().min(10).max(2000), verifiedProductName: z.string().trim().min(2).max(180) }).strict() }).strict();

@ApiTags('operations')
@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller('operations')
export class OperationsController {
  constructor(private readonly disputes: DisputeRefundService, private readonly payouts: OrganizerPayoutService, private readonly providers: ProviderOperationsService, private readonly reports: ReportsService, private readonly audit: AuditService, private readonly compliance: ComplianceService, private readonly exceptions: FinancialExceptionService, private readonly tiers: FinancialTierReviewService, private readonly support: CustomerSupportService, private readonly owner: OwnerGovernanceService) {}

  @Get('owner/overview') @RequirePermissions('ops.owner.read')
  async ownerOverview(@Req() req: AuthenticatedFastifyRequest) { requireOwner(req); return this.owner.overview(); }
  @Get('owner/customers') @RequirePermissions('ops.owner.read')
  async ownerCustomers(@Req() req: AuthenticatedFastifyRequest, @Query('search') search?: string) {
    requireOwner(req); return this.owner.customers({ search });
  }
  @Get('owner/staff') @RequirePermissions('ops.owner.read')
  async ownerStaff(@Req() req: AuthenticatedFastifyRequest) { requireOwner(req); return this.owner.staff(); }
  @Get('owner/staff/reviews') @RequirePermissions('ops.owner.read')
  async ownerReviews(@Req() req: AuthenticatedFastifyRequest) { requireOwner(req); return this.owner.reviews(); }
  @Post('owner/staff/reviews') @RequirePermissions('ops.owner.staff.prepare')
  async ownerPrepare(@Req() req: AuthenticatedFastifyRequest,
    @Body(new ZodValidationPipe(StaffProposal)) body: z.infer<typeof StaffProposal>) {
    requireOwner(req); const actor = requirePrincipal(req);
    return { review: await this.owner.prepare({ ...body, actorUserId: actor.userId,
      sessionId: actor.sessionId, requestId: req.id }) };
  }
  @Post('owner/staff/reviews/:reviewId/approve') @RequirePermissions('ops.owner.staff.approve')
  async ownerApprove(@Req() req: AuthenticatedFastifyRequest,
    @Param('reviewId', new ZodValidationPipe(UuidParam)) reviewId: string) {
    requireOwner(req); const actor = requirePrincipal(req);
    return { review: await this.owner.decide({ reviewId, actorUserId: actor.userId,
      sessionId: actor.sessionId, decision: 'APPROVED', requestId: req.id }) };
  }
  @Post('owner/staff/reviews/:reviewId/reject') @RequirePermissions('ops.owner.staff.approve')
  async ownerReject(@Req() req: AuthenticatedFastifyRequest,
    @Param('reviewId', new ZodValidationPipe(UuidParam)) reviewId: string,
    @Body(new ZodValidationPipe(StaffRejection)) body: z.infer<typeof StaffRejection>) {
    requireOwner(req); const actor = requirePrincipal(req);
    return { review: await this.owner.decide({ reviewId, actorUserId: actor.userId,
      sessionId: actor.sessionId, decision: 'REJECTED', reason: body.reason, requestId: req.id }) };
  }

  @Get('owner/customers/suspensions') @RequirePermissions('ops.owner.read')
  async ownerSuspensions(@Req() req:AuthenticatedFastifyRequest){requireOwner(req);return this.owner.suspensionReviews();}
  @Post('owner/customers/suspensions') @RequirePermissions('ops.owner.staff.prepare')
  async ownerPrepareSuspension(@Req() req:AuthenticatedFastifyRequest,
    @Body(new ZodValidationPipe(z.object({targetUserId:z.uuid(),reason:z.string().trim().min(20).max(500)}).strict())) body:{targetUserId:string;reason:string}) {
    requireOwner(req);const actor=requirePrincipal(req);
    return {review:await this.owner.prepareSuspension({...body,actorUserId:actor.userId,sessionId:actor.sessionId,requestId:req.id})};
  }
  @Post('owner/customers/suspensions/:reviewId/approve') @RequirePermissions('ops.owner.staff.approve')
  async ownerApproveSuspension(@Req() req:AuthenticatedFastifyRequest,
    @Param('reviewId',new ZodValidationPipe(UuidParam)) reviewId:string){
    requireOwner(req);const actor=requirePrincipal(req);
    return {review:await this.owner.decideSuspension({reviewId,actorUserId:actor.userId,sessionId:actor.sessionId,
      decision:'APPROVED',requestId:req.id})};
  }
  @Post('owner/customers/suspensions/:reviewId/reject') @RequirePermissions('ops.owner.staff.approve')
  async ownerRejectSuspension(@Req() req:AuthenticatedFastifyRequest,
    @Param('reviewId',new ZodValidationPipe(UuidParam)) reviewId:string,
    @Body(new ZodValidationPipe(StaffRejection)) body:z.infer<typeof StaffRejection>){
    requireOwner(req);const actor=requirePrincipal(req);
    return {review:await this.owner.decideSuspension({reviewId,actorUserId:actor.userId,sessionId:actor.sessionId,
      decision:'REJECTED',reason:body.reason,requestId:req.id})};
  }

  @Get('dashboard') @RequirePermissions('ops.dashboard.read') async dashboard() { return this.reports.dashboard(); }
  @Get('compliance') @RequirePermissions('ops.compliance.read') async complianceSnapshot() { return this.compliance.snapshot(); }
  @Get('support/cases') @RequirePermissions('ops.support.read') async supportCases(@Req() req:AuthenticatedFastifyRequest){requireMfa(req);return {cases:await this.support.queue()};}
  @Get('support/cases/:reference') @RequirePermissions('ops.support.read') async supportCase(@Param('reference',new ZodValidationPipe(SupportRef)) reference:string,@Req() req:AuthenticatedFastifyRequest){requireMfa(req);return {case:await this.support.staffDetail(reference)};}
  @Post('support/cases/:reference/replies') @RequirePermissions('ops.support.reply') async replySupport(@Param('reference',new ZodValidationPipe(SupportRef)) reference:string,@Body(new ZodValidationPipe(SupportReply)) body:z.infer<typeof SupportReply>,@Req() req:AuthenticatedFastifyRequest){requireMfa(req);const actor=requirePrincipal(req);return {case:await this.support.staffReply({staffUserId:actor.userId,reference,requestId:req.id,...body})};}
  @Post('support/cases/:reference/close') @RequirePermissions('ops.support.reply') async closeSupport(@Param('reference',new ZodValidationPipe(SupportRef)) reference:string,@Req() req:AuthenticatedFastifyRequest){requireMfa(req);return {case:await this.support.staffClose({staffUserId:requirePrincipal(req).userId,reference,requestId:req.id})};}

  @Get('refunds') @RequirePermissions('ops.disputes.review') async refunds() { return { refunds: await this.disputes.listRefundQueue() }; }
  @Get('disputes') @RequirePermissions('ops.disputes.review') async disputeQueue(@Req() req:AuthenticatedFastifyRequest){requireMfa(req);return {disputes:await this.disputes.listReviewDisputes()};}
  @Get('disputes/:reference') @RequirePermissions('ops.disputes.review') async dispute(@Param('reference') reference: string,@Req() req:AuthenticatedFastifyRequest) {requireMfa(req);return { dispute: await this.disputes.disputeDetail(reference) }; }

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

  @Get('financial-eligibility/reviews') @RequirePermissions('ops.tiers.read')
  async financialTierQueue(@Req() req: AuthenticatedFastifyRequest) { requireMfa(req); return this.tiers.queue(); }

  @Post('financial-eligibility/:userId/prepare') @RequirePermissions('ops.tiers.prepare')
  async prepareFinancialTier(@Param('userId', new ZodValidationPipe(UuidParam)) userId: string,
    @Body(new ZodValidationPipe(TierProposal)) body: z.infer<typeof TierProposal>,
    @Req() req: AuthenticatedFastifyRequest) {
    requireMfa(req); const actor = requirePrincipal(req);
    return { review: await this.tiers.prepare({ userId, actorUserId: actor.userId, sessionId: actor.sessionId,
      tier: body.tier, maxPerIntentMinor: BigInt(body.maxPerIntentMinor),
      maxDailyDebitMinor: BigInt(body.maxDailyDebitMinor), evidenceReference: body.evidenceReference,
      note: body.note, requestId: req.id }) };
  }

  @Post('financial-eligibility/reviews/:reviewId/approve') @RequirePermissions('ops.tiers.approve')
  async approveFinancialTier(@Param('reviewId', new ZodValidationPipe(UuidParam)) reviewId: string,
    @Req() req: AuthenticatedFastifyRequest) {
    requireMfa(req); const actor = requirePrincipal(req);
    return { review: await this.tiers.approve({ reviewId, actorUserId: actor.userId,
      sessionId: actor.sessionId, requestId: req.id }) };
  }

  @Post('financial-eligibility/reviews/:reviewId/reject') @RequirePermissions('ops.tiers.approve')
  async rejectFinancialTier(@Param('reviewId', new ZodValidationPipe(UuidParam)) reviewId: string,
    @Body(new ZodValidationPipe(Reason)) body: z.infer<typeof Reason>,
    @Req() req: AuthenticatedFastifyRequest) {
    requireMfa(req); const actor = requirePrincipal(req);
    return { review: await this.tiers.reject({ reviewId, actorUserId: actor.userId,
      sessionId: actor.sessionId, reason: body.reason, requestId: req.id }) };
  }

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
