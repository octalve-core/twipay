import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ApiBody, ApiCookieAuth, ApiForbiddenResponse, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
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
import { OwnerApiContracts } from './owner-openapi.js';
import { OwnerStaffInvitationService } from '../application/owner-staff-invitation.service.js';
import { OwnerConfigurationReviewService, ConfigProposal } from '../application/owner-configuration-review.service.js';

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
@ApiCookieAuth()
@ApiUnauthorizedResponse({ description: 'Valid active opaque session required' })
@ApiForbiddenResponse({ description: 'MFA, owner role or required permission missing' })
@UseGuards(SessionAuthGuard, PermissionGuard)
@Controller('operations')
export class OperationsController {
  constructor(private readonly disputes: DisputeRefundService, private readonly payouts: OrganizerPayoutService, private readonly providers: ProviderOperationsService, private readonly reports: ReportsService, private readonly audit: AuditService, private readonly compliance: ComplianceService, private readonly exceptions: FinancialExceptionService, private readonly tiers: FinancialTierReviewService, private readonly support: CustomerSupportService, private readonly owner: OwnerGovernanceService, private readonly invitations: OwnerStaffInvitationService, private readonly configReviews: OwnerConfigurationReviewService) {}

  @Get('owner/overview')
  @ApiOperation({ summary: 'Owner overview: observed database figures, not settlement' })
  @ApiResponse({ status: 200, schema: OwnerApiContracts.overviewResponse }) @RequirePermissions('ops.owner.read')
  async ownerOverview(@Req() req: AuthenticatedFastifyRequest) { requireOwner(req); return this.owner.overview(); }
  @Get('owner/risk') @RequirePermissions('ops.owner.read')
  @ApiOperation({ summary: 'Owner aggregate provider, ticket, security and pending-review observations (read-only)' })
  @ApiResponse({ status: 200, schema: OwnerApiContracts.riskResponse })
  async ownerRisk(@Req() req: AuthenticatedFastifyRequest) { requireOwner(req); return this.owner.riskOverview(); }
  @Get('owner/customers/:userId/activity') @RequirePermissions('ops.owner.read')
  @ApiParam({ name: 'userId', schema: { type: 'string', format: 'uuid' } })
  @ApiOperation({ summary: 'Owner view of masked, aggregate customer activity (read-only)' })
  @ApiResponse({ status: 200, schema: OwnerApiContracts.activityResponse })
  async ownerCustomerActivity(@Req() req: AuthenticatedFastifyRequest,
    @Param('userId', new ZodValidationPipe(UuidParam)) userId: string) {
    requireOwner(req); return this.owner.customerActivity(userId);
  }
  @Get('owner/customers')
  @ApiOperation({ summary: 'Owner masked customer directory; exact lookup or bounded list' })
  @ApiResponse({ status: 200, schema: OwnerApiContracts.customersResponse }) @RequirePermissions('ops.owner.read')
  async ownerCustomers(@Req() req: AuthenticatedFastifyRequest, @Query('search') search?: string) {
    requireOwner(req); return this.owner.customers({ search });
  }
  @Get('owner/staff')
  @ApiOperation({ summary: 'Owner active role-assignment snapshot' })
  @ApiResponse({ status: 200, schema: OwnerApiContracts.staffResponse }) @RequirePermissions('ops.owner.read')
  async ownerStaff(@Req() req: AuthenticatedFastifyRequest) { requireOwner(req); return this.owner.staff(); }
  @Get('owner/staff/reviews')
  @ApiOperation({ summary: 'Read pending two-owner staff reviews' })
  @ApiResponse({ status: 200, schema: OwnerApiContracts.reviewsResponse }) @RequirePermissions('ops.owner.read')
  async ownerReviews(@Req() req: AuthenticatedFastifyRequest) { requireOwner(req); return this.owner.reviews(); }
  @Post('owner/staff/reviews')
  @ApiHeader({ name: 'x-csrf-token', required: true, description: 'Current opaque-session CSRF token from /v1/auth/csrf' })
  @ApiOperation({ summary: 'Prepare staff role grant/revocation; does not change access' })
  @ApiResponse({ status: 201, schema: OwnerApiContracts.mutationResponse })
  @ApiBody({ schema: OwnerApiContracts.staffProposal }) @RequirePermissions('ops.owner.staff.prepare')
  async ownerPrepare(@Req() req: AuthenticatedFastifyRequest,
    @Body(new ZodValidationPipe(StaffProposal)) body: z.infer<typeof StaffProposal>) {
    requireOwner(req); const actor = requirePrincipal(req);
    return { review: await this.owner.prepare({ ...body, actorUserId: actor.userId,
      sessionId: actor.sessionId, requestId: req.id }) };
  }
  @Post('owner/staff/reviews/:reviewId/approve')
  @ApiParam({ name: 'reviewId', schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'x-csrf-token', required: true, description: 'Current opaque-session CSRF token from /v1/auth/csrf' })
  @ApiOperation({ summary: 'Second owner approves staged staff role change; may revoke target sessions' })
  @ApiResponse({ status: 201, schema: OwnerApiContracts.mutationResponse }) @RequirePermissions('ops.owner.staff.approve')
  async ownerApprove(@Req() req: AuthenticatedFastifyRequest,
    @Param('reviewId', new ZodValidationPipe(UuidParam)) reviewId: string) {
    requireOwner(req); const actor = requirePrincipal(req);
    return { review: await this.owner.decide({ reviewId, actorUserId: actor.userId,
      sessionId: actor.sessionId, decision: 'APPROVED', requestId: req.id }) };
  }
  @Post('owner/staff/reviews/:reviewId/reject')
  @ApiParam({ name: 'reviewId', schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'x-csrf-token', required: true, description: 'Current opaque-session CSRF token from /v1/auth/csrf' })
  @ApiOperation({ summary: 'Second owner rejects staged staff role change' })
  @ApiResponse({ status: 201, schema: OwnerApiContracts.mutationResponse })
  @ApiBody({ schema: OwnerApiContracts.staffRejection }) @RequirePermissions('ops.owner.staff.approve')
  async ownerReject(@Req() req: AuthenticatedFastifyRequest,
    @Param('reviewId', new ZodValidationPipe(UuidParam)) reviewId: string,
    @Body(new ZodValidationPipe(StaffRejection)) body: z.infer<typeof StaffRejection>) {
    requireOwner(req); const actor = requirePrincipal(req);
    return { review: await this.owner.decide({ reviewId, actorUserId: actor.userId,
      sessionId: actor.sessionId, decision: 'REJECTED', reason: body.reason, requestId: req.id }) };
  }

  @Get('owner/customers/suspensions')
  @ApiOperation({ summary: 'Read pending independently reviewed account restrictions' })
  @ApiResponse({ status: 200, schema: OwnerApiContracts.suspensionsResponse }) @RequirePermissions('ops.owner.read')
  async ownerSuspensions(@Req() req:AuthenticatedFastifyRequest){requireOwner(req);return this.owner.suspensionReviews();}
  @Post('owner/customers/suspensions')
  @ApiHeader({ name: 'x-csrf-token', required: true, description: 'Current opaque-session CSRF token from /v1/auth/csrf' })
  @ApiOperation({ summary: 'Prepare independently reviewed account suspension; no wallet changes' })
  @ApiResponse({ status: 201, schema: OwnerApiContracts.mutationResponse })
  @ApiBody({ schema: OwnerApiContracts.suspensionProposal }) @RequirePermissions('ops.owner.staff.prepare')
  async ownerPrepareSuspension(@Req() req:AuthenticatedFastifyRequest,
    @Body(new ZodValidationPipe(z.object({targetUserId:z.uuid(),reason:z.string().trim().min(20).max(500)}).strict())) body:{targetUserId:string;reason:string}) {
    requireOwner(req);const actor=requirePrincipal(req);
    return {review:await this.owner.prepareSuspension({...body,actorUserId:actor.userId,sessionId:actor.sessionId,requestId:req.id})};
  }
  @Post('owner/customers/suspensions/:reviewId/approve')
  @ApiParam({ name: 'reviewId', schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'x-csrf-token', required: true, description: 'Current opaque-session CSRF token from /v1/auth/csrf' })
  @ApiOperation({ summary: 'Second owner approves account suspension and session revocation' })
  @ApiResponse({ status: 201, schema: OwnerApiContracts.mutationResponse }) @RequirePermissions('ops.owner.staff.approve')
  async ownerApproveSuspension(@Req() req:AuthenticatedFastifyRequest,
    @Param('reviewId',new ZodValidationPipe(UuidParam)) reviewId:string){
    requireOwner(req);const actor=requirePrincipal(req);
    return {review:await this.owner.decideSuspension({reviewId,actorUserId:actor.userId,sessionId:actor.sessionId,
      decision:'APPROVED',requestId:req.id})};
  }
  @Post('owner/customers/suspensions/:reviewId/reject')
  @ApiParam({ name: 'reviewId', schema: { type: 'string', format: 'uuid' } })
  @ApiHeader({ name: 'x-csrf-token', required: true, description: 'Current opaque-session CSRF token from /v1/auth/csrf' })
  @ApiOperation({ summary: 'Second owner rejects account suspension' })
  @ApiResponse({ status: 201, schema: OwnerApiContracts.mutationResponse })
  @ApiBody({ schema: OwnerApiContracts.staffRejection }) @RequirePermissions('ops.owner.staff.approve')
  async ownerRejectSuspension(@Req() req:AuthenticatedFastifyRequest,
    @Param('reviewId',new ZodValidationPipe(UuidParam)) reviewId:string,
    @Body(new ZodValidationPipe(StaffRejection)) body:z.infer<typeof StaffRejection>){
    requireOwner(req);const actor=requirePrincipal(req);
    return {review:await this.owner.decideSuspension({reviewId,actorUserId:actor.userId,sessionId:actor.sessionId,
      decision:'REJECTED',reason:body.reason,requestId:req.id})};
  }

  // New-staff invitations: prepared and checked by separate owners, then accepted only by the
  // verified email holder with an active recent-MFA session. No token is returned to admins.
  @Get('owner/staff/invitations') @RequirePermissions('ops.owner.read')
  @ApiOperation({ summary: 'Pending and approved limited-role invitations; email masked' })
  @ApiResponse({ status: 200, schema: OwnerApiContracts.invitationsResponse })
  async ownerInvitations(@Req() req: AuthenticatedFastifyRequest) { requireOwner(req); return this.invitations.queue(); }

  @Post('owner/staff/invitations') @RequirePermissions('ops.owner.staff.prepare')
  @ApiHeader({ name: 'x-csrf-token', required: true })
  @ApiBody({ schema: OwnerApiContracts.invitationProposal })
  @ApiResponse({ status: 201, schema: OwnerApiContracts.mutationResponse })
  async ownerPrepareInvitation(@Req() req: AuthenticatedFastifyRequest,
    @Body(new ZodValidationPipe(z.object({ email: z.email().max(320), roleCode: z.enum(DELEGABLE_STAFF_ROLES),
      reason: z.string().trim().min(20).max(500) }).strict())) body: { email: string; roleCode: string; reason: string }) {
    requireOwner(req); const principal = requirePrincipal(req);
    return { review: await this.invitations.prepare({ ...body, actorUserId: principal.userId,
      sessionId: principal.sessionId, requestId: req.id }) };
  }
  @Post('owner/staff/invitations/:invitationId/:action') @RequirePermissions('ops.owner.staff.approve')
  @ApiHeader({ name: 'x-csrf-token', required: true })
  @ApiParam({ name: 'invitationId', schema: { type: 'string', format: 'uuid' } })
  @ApiParam({ name: 'action', schema: { type: 'string', enum: ['approve','reject','revoke'] } })
  @ApiBody({ schema: OwnerApiContracts.invitationDecision })
  @ApiResponse({ status: 201, schema: OwnerApiContracts.mutationResponse })
  async ownerDecideInvitation(@Req() req: AuthenticatedFastifyRequest,
    @Param('invitationId', new ZodValidationPipe(UuidParam)) invitationId: string,
    @Param('action', new ZodValidationPipe(z.enum(['approve','reject','revoke']))) action: 'approve'|'reject'|'revoke',
    @Body(new ZodValidationPipe(z.object({ reason: z.string().trim().min(20).max(500).optional() }).strict())) body: { reason?: string }) {
    requireOwner(req); const principal = requirePrincipal(req);
    const map = { approve: 'APPROVED', reject: 'REJECTED', revoke: 'REVOKED' } as const;
    return { review: await this.invitations.decide({ invitationId, actorUserId: principal.userId,
      sessionId: principal.sessionId, action: map[action], reason: body.reason, requestId: req.id }) };
  }
  @Get('staff/invitations/mine')
  @ApiOperation({ summary: 'Authenticated email-verified customer: own approved pending staff invitations' })
  @ApiResponse({ status: 200, schema: OwnerApiContracts.myInvitationsResponse })
  async myStaffInvitations(@Req() req: AuthenticatedFastifyRequest) {
    return this.invitations.mine(requirePrincipal(req).userId);
  }
  @Post('staff/invitations/:invitationId/accept')
  @ApiHeader({ name: 'x-csrf-token', required: true })
  @ApiParam({ name: 'invitationId', schema: { type: 'string', format: 'uuid' } })
  @ApiOperation({ summary: 'Verified invited customer consents to a limited role; revokes active sessions' })
  @ApiResponse({ status: 201, schema: OwnerApiContracts.acceptanceResponse })
  async acceptStaffInvitation(@Req() req: AuthenticatedFastifyRequest,
    @Param('invitationId', new ZodValidationPipe(UuidParam)) invitationId: string) {
    requireMfa(req); const principal = requirePrincipal(req);
    return this.invitations.accept({ invitationId, userId: principal.userId,
      sessionId: principal.sessionId, requestId: req.id });
  }
  @Get('owner/config/reviews') @RequirePermissions('ops.owner.read')
  @ApiOperation({ summary: 'Read bounded pending owner-approved nonfinancial configuration changes' })
  @ApiResponse({ status: 200, schema: OwnerApiContracts.configReviewsResponse })
  async ownerConfigQueue(@Req() req: AuthenticatedFastifyRequest) { requireOwner(req); return this.configReviews.queue(); }
  @Post('owner/config/reviews') @RequirePermissions('ops.owner.staff.prepare')
  @ApiHeader({ name: 'x-csrf-token', required: true })
  @ApiBody({ schema: OwnerApiContracts.configProposal })
  @ApiResponse({ status: 201, schema: OwnerApiContracts.mutationResponse })
  async ownerPrepareConfig(@Req() req: AuthenticatedFastifyRequest,
    @Body(new ZodValidationPipe(ConfigProposal)) body: z.infer<typeof ConfigProposal>) {
    requireOwner(req); const principal = requirePrincipal(req);
    return { review: await this.configReviews.prepare({ ...body, actorUserId: principal.userId,
      sessionId: principal.sessionId, requestId: req.id }) };
  }
  @Post('owner/config/reviews/:reviewId/:decision') @RequirePermissions('ops.owner.staff.approve')
  @ApiHeader({ name: 'x-csrf-token', required: true })
  @ApiParam({ name: 'reviewId', schema: { type: 'string', format: 'uuid' } })
  @ApiParam({ name: 'decision', schema: { type: 'string', enum: ['approve','reject'] } })
  @ApiBody({ schema: OwnerApiContracts.invitationDecision })
  @ApiResponse({ status: 201, schema: OwnerApiContracts.mutationResponse })
  async ownerDecideConfig(@Req() req: AuthenticatedFastifyRequest,
    @Param('reviewId', new ZodValidationPipe(UuidParam)) reviewId: string,
    @Param('decision', new ZodValidationPipe(z.enum(['approve','reject']))) decision: 'approve'|'reject',
    @Body(new ZodValidationPipe(z.object({ reason: z.string().trim().min(20).max(500).optional() }).strict())) body: { reason?: string }) {
    requireOwner(req); const principal = requirePrincipal(req);
    return { review: await this.configReviews.decide({ reviewId, actorUserId: principal.userId,
      sessionId: principal.sessionId, decision: decision === 'approve' ? 'APPROVED' : 'REJECTED',
      reason: body.reason, requestId: req.id }) };
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
  async rejectPayout(@Param('reference') reference:string,@Body(new ZodValidationPipe(Reason)) body:z.infer<typeof Reason>,@Req() req:AuthenticatedFastifyRequest){const p=requirePrincipal(req);return {payout:await this.payouts.reject({reference,actorUserId:p.userId,sessionId:p.sessionId,reason:body.reason,requestId:req.id})};}
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
  async updateOffer(@Param('offerId') offerId:string,@Body(new ZodValidationPipe(OfferControl)) body:z.infer<typeof OfferControl>,@Req() req:AuthenticatedFastifyRequest){const p=requirePrincipal(req);return {offer:await this.providers.updateOffer({offerId,actorUserId:p.userId,sessionId:p.sessionId,reason:body.reason,requestId:req.id,...(body.active!==undefined?{active:body.active}:{}),...(body.priority!==undefined?{priority:body.priority}:{}),...(body.estimatedCostMinor!==undefined?{estimatedCostMinor:body.estimatedCostMinor===null?null:BigInt(body.estimatedCostMinor)}:{})})};}
  @Post('providers/health/:healthId/reset') @RequirePermissions('ops.providers.manage')
  async resetCircuit(@Param('healthId') healthId:string,@Body(new ZodValidationPipe(Reason)) body:z.infer<typeof Reason>,@Req() req:AuthenticatedFastifyRequest){const p=requirePrincipal(req);return {health:await this.providers.resetCircuit({healthId,actorUserId:p.userId,sessionId:p.sessionId,reason:body.reason,requestId:req.id})};}
  @Post('catalog/offers/:offerId/verify-equivalence') @RequirePermissions('ops.catalog.map')
  async verifyMapping(@Param('offerId') offerId:string,@Body(new ZodValidationPipe(Mapping)) body:z.infer<typeof Mapping>,@Req() req:AuthenticatedFastifyRequest){const p=requirePrincipal(req);return {offer:await this.providers.verifyEquivalence({offerId,canonicalProductId:body.canonicalProductId,actorUserId:p.userId,sessionId:p.sessionId,evidence:body.evidence,reason:body.reason,requestId:req.id})};}

  @Get('reports') @RequirePermissions('ops.reports.read') async reportsView(){return this.reports.dashboard();}
  @Get('audit') @RequirePermissions('ops.audit.read') async auditTrail(@Query('limit') limit?:string){const parsed=Number(limit??100);return {events:await this.audit.list(Number.isFinite(parsed)?parsed:100)};}
}
