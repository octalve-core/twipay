import {
  Body,
  Controller,
  ConflictException,
  Get,
  Post,
  Query,
  Patch,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { isRecentMfaAssurance } from '@twipay/security';
import { ZodValidationPipe } from '../../../platform/http/zod-validation.pipe.js';
import { AuthService } from '../application/auth.service.js';
import { PasswordEnrollmentService } from '../application/password-enrollment.service.js';
import { TransactionPinService } from '../application/transaction-pin.service.js';
import { PasswordSecurityService } from '../application/password-security.service.js';
import { GoogleOidcService, GOOGLE_OIDC_COOKIE, GOOGLE_OIDC_FLOW_TTL_SECONDS } from '../infrastructure/google-oidc.service.js';
import { SessionAuthGuard, requirePrincipal, type AuthenticatedFastifyRequest } from './session-auth.guard.js';
import { SessionService } from '../application/session.service.js';
import { ContactVerificationService } from '../application/contact-verification.service.js';
import { contactVerified } from '../application/contact-permissions.js';
import { AllowUnverifiedContact } from './session-auth.guard.js';
import { clearSessionCookies, csrfCookieName, sessionCookieName, setSessionCookies } from './session-cookie.js';

const FourDigitPin = z.string().regex(/^\d{4}$/);
const EightDigitCode = z.string().regex(/^\d{8}$/);
const PinSetSchema = z.object({ password: z.string().min(1).max(128), pin: FourDigitPin }).strict();
const PinChangeSchema = z.object({ password: z.string().min(1).max(128), oldPin: FourDigitPin, newPin: FourDigitPin }).strict();
const PinResetRequestSchema = z.object({ password: z.string().min(1).max(128) }).strict();
const PinResetCompleteSchema = z.object({ password: z.string().min(1).max(128), code: EightDigitCode, newPin: FourDigitPin }).strict();
const PasswordEnrollmentSchema = z.object({ code: EightDigitCode, password: z.string().min(12).max(128) }).strict();
const GoogleLinkSchema = z.object({currentPassword: z.string().min(1).max(128)}).strict();
const RegisterSchema = z
  .object({
    email: z.email().max(320),
    password: z.string().min(12).max(128),
    givenName: z.string().trim().min(1).max(100),
    familyName: z.string().trim().min(1).max(100),
  })
  .strict();
const PasswordResetRequestSchema = z.object({ email: z.email().max(320) }).strict();
const PasswordResetCompleteSchema = z.object({ email: z.email().max(320), code: z.string().regex(/^\d{8}$/), newPassword: z.string().min(12).max(128) }).strict();
const ChangePasswordSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(12).max(128) }).strict();
const RevokeOtherSessionsSchema = z.object({ currentPassword: z.string().min(1).max(128) }).strict();
const EmailCodeSchema = z.object({ code: z.string().regex(/^\d{6}$/) }).strict();
const ProfileSchema = z.object({ givenName: z.string().trim().min(1).max(100).nullable().optional(), familyName: z.string().trim().min(1).max(100).nullable().optional() }).strict().refine((value) => value.givenName !== undefined || value.familyName !== undefined, 'at least one field must change');
const LoginSchema = z
  .object({ email: z.email().max(320), password: z.string().min(1).max(128) })
  .strict();

@ApiTags('authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly contacts: ContactVerificationService,
    private readonly passwordSecurity: PasswordSecurityService,
    private readonly google: GoogleOidcService,
    private readonly pin: TransactionPinService,
    private readonly passwordEnrollment: PasswordEnrollmentService,
  ) {}

  @Get('password/enrollment/status')
  @UseGuards(SessionAuthGuard)
  passwordEnrollmentStatus(@Req() req: AuthenticatedFastifyRequest) {
    return this.passwordEnrollment.status(requirePrincipal(req).userId);
  }

  @Post('password/enrollment/request')
  @UseGuards(SessionAuthGuard)
  passwordEnrollmentRequest(@Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    return this.passwordEnrollment.request(principal.userId, principal.sessionId);
  }

  @Post('password/enrollment/complete')
  @UseGuards(SessionAuthGuard)
  async passwordEnrollmentComplete(@Body(new ZodValidationPipe(PasswordEnrollmentSchema)) body: z.infer<typeof PasswordEnrollmentSchema>, @Req() req: AuthenticatedFastifyRequest, @Res({ passthrough: true }) res: FastifyReply) {
    const principal = requirePrincipal(req);
    const result = await this.passwordEnrollment.complete(principal.userId, principal.sessionId, body.code, body.password);
    clearSessionCookies(res);
    return result;
  }

  @Get('transaction-pin/status')
  @UseGuards(SessionAuthGuard)
  async transactionPinStatus(@Req() req: AuthenticatedFastifyRequest) {
    return { status: await this.pin.status(requirePrincipal(req).userId) };
  }

  @Post('transaction-pin/set')
  @UseGuards(SessionAuthGuard)
  transactionPinSet(@Body(new ZodValidationPipe(PinSetSchema)) body: z.infer<typeof PinSetSchema>, @Req() req: AuthenticatedFastifyRequest) {
    return this.pin.setPin(requirePrincipal(req).userId, body.password, body.pin);
  }

  @Post('transaction-pin/change')
  @UseGuards(SessionAuthGuard)
  transactionPinChange(@Body(new ZodValidationPipe(PinChangeSchema)) body: z.infer<typeof PinChangeSchema>, @Req() req: AuthenticatedFastifyRequest) {
    return this.pin.changePin(requirePrincipal(req).userId, body.password, body.oldPin, body.newPin);
  }

  @Post('transaction-pin/reset/request')
  @UseGuards(SessionAuthGuard)
  transactionPinResetRequest(@Body(new ZodValidationPipe(PinResetRequestSchema)) body: z.infer<typeof PinResetRequestSchema>, @Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    return this.pin.requestReset(principal.userId, principal.sessionId, body.password);
  }

  @Post('transaction-pin/reset/complete')
  @UseGuards(SessionAuthGuard)
  transactionPinResetComplete(@Body(new ZodValidationPipe(PinResetCompleteSchema)) body: z.infer<typeof PinResetCompleteSchema>, @Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    return this.pin.completeReset(principal.userId, principal.sessionId, body.password, body.code, body.newPin);
  }

  @Get('google/status')
  googleStatus() {
    return { enabled: this.google.enabled() };
  }

  @Post('google/start')
  async startGoogleSignIn(@Res({ passthrough: true }) res: FastifyReply) {
    const flow = await this.google.start({ purpose: 'SIGN_IN' });
    res.setCookie(GOOGLE_OIDC_COOKIE, flow.browserBinding, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax', // Required for Google's top-level cross-site callback navigation.
      path: '/v1/auth/google/callback',
      maxAge: GOOGLE_OIDC_FLOW_TTL_SECONDS,
    });
    return { authorizationUrl: flow.authorizationUrl };
  }

  @Post('google/link/start')
  @UseGuards(SessionAuthGuard)
  async startGoogleLink(
    @Body(new ZodValidationPipe(GoogleLinkSchema)) body: z.infer<typeof GoogleLinkSchema>,
    @Req() req: AuthenticatedFastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const principal = requirePrincipal(req);
    const flow = await this.google.start({ purpose: 'LINK', userId: principal.userId, sessionId: principal.sessionId, currentPassword: body.currentPassword });
    res.setCookie(GOOGLE_OIDC_COOKIE, flow.browserBinding, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      path: '/v1/auth/google/callback',
      maxAge: GOOGLE_OIDC_FLOW_TTL_SECONDS,
    });
    return { authorizationUrl: flow.authorizationUrl };
  }

  @Get('google/link/status')
  @UseGuards(SessionAuthGuard)
  async googleLinkStatus(@Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    return { linked: await this.google.isLinked(principal.userId) };
  }

  @Get('google/callback')
  async googleCallback(
    @Query('state') state: string | undefined,
    @Query('code') code: string | undefined,
    @Req() req: FastifyRequest,
    @Res() res: FastifyReply,
  ) {
    // No provider response data is echoed to the browser or logs.
    let outcome = 'failed';
    let linked = false;
    try {
      const result = await this.google.complete({ state, code, binding: req.cookies[GOOGLE_OIDC_COOKIE], userAgent: req.headers['user-agent'], ip: req.ip });
      if (result.purpose === 'SIGN_IN' && result.session) setSessionCookies(res, result.session);
      linked = result.purpose === 'LINK';
      outcome = 'ok';
    } catch (error) {
      if (error instanceof ConflictException) outcome = 'link_required';
    }
    res.clearCookie(GOOGLE_OIDC_COOKIE, {
      path: '/v1/auth/google/callback',
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
    });
    const target = new URL(linked && outcome === 'ok' ? '/dashboard/settings/security' : '/auth/google-complete', process.env['APP_URL']);
    target.searchParams.set('google', linked ? 'linked' : outcome);
    return res.status(303).redirect(target.href);
  }

  @Post('password/reset/request')
  async requestPasswordReset(@Body(new ZodValidationPipe(PasswordResetRequestSchema)) body: z.infer<typeof PasswordResetRequestSchema>) {
    return this.passwordSecurity.requestReset(body.email);
  }

  @Post('password/reset/complete')
  async completePasswordReset(@Body(new ZodValidationPipe(PasswordResetCompleteSchema)) body: z.infer<typeof PasswordResetCompleteSchema>) {
    return this.passwordSecurity.completeReset(body.email, body.code, body.newPassword);
  }

  @Post('password/change')
  @UseGuards(SessionAuthGuard)
  async changePassword(
    @Body(new ZodValidationPipe(ChangePasswordSchema)) body: z.infer<typeof ChangePasswordSchema>,
    @Req() req: AuthenticatedFastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const result = await this.passwordSecurity.changePassword(requirePrincipal(req).userId, body.currentPassword, body.newPassword);
    clearSessionCookies(res); // Password change revokes every old session, including this one.
    return result;
  }

  @Get('sessions')
  @UseGuards(SessionAuthGuard)
  async listSessions(@Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    return { sessions: await this.passwordSecurity.listSessions(principal.userId, principal.sessionId) };
  }

  @Post('sessions/revoke-others')
  @UseGuards(SessionAuthGuard)
  async revokeOtherSessions(@Body(new ZodValidationPipe(RevokeOtherSessionsSchema)) body: z.infer<typeof RevokeOtherSessionsSchema>, @Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    return this.passwordSecurity.revokeOtherSessions(principal.userId, principal.sessionId, body.currentPassword);
  }

  @Post('register')
  async register(
    @Body(new ZodValidationPipe(RegisterSchema)) body: z.infer<typeof RegisterSchema>,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const result = await this.auth.register(body, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    setSessionCookies(res, result.session);
    return { user: result.user, csrfToken: result.session.csrfToken, verificationDelivery: result.deliveryStatus };
  }

  @Post('contact/email/resend')
  @UseGuards(SessionAuthGuard)
  @AllowUnverifiedContact()
  async resendEmail(@Req() req: AuthenticatedFastifyRequest) {
    return { deliveryStatus: await this.contacts.resend(requirePrincipal(req).userId) };
  }

  @Post('contact/email/confirm')
  @UseGuards(SessionAuthGuard)
  @AllowUnverifiedContact()
  async confirmEmail(
    @Body(new ZodValidationPipe(EmailCodeSchema)) body: z.infer<typeof EmailCodeSchema>,
    @Req() req: AuthenticatedFastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const principal = requirePrincipal(req);
    await this.contacts.confirm(principal.userId, body.code);
    // Upgrade restricted sessions with a new opaque token; MFA remains independently required.
    const session = await this.sessions.rotate(principal.sessionId, { mfaSatisfiedAt: null, reason: 'CONTACT_EMAIL_VERIFIED' });
    setSessionCookies(res, session);
    return { verified: true, csrfToken: session.csrfToken };
  }

  @Post('login')
  async login(
    @Body(new ZodValidationPipe(LoginSchema)) body: z.infer<typeof LoginSchema>,
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const result = await this.auth.login(body, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    setSessionCookies(res, result.session);
    return { user: result.user, csrfToken: result.session.csrfToken };
  }

  @Get('csrf')
  async csrf(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const token = req.cookies[sessionCookieName()];
    if (!token) throw new UnauthorizedException();
    const csrfToken = await this.sessions.issueCsrf(token);
    res.setCookie(csrfCookieName(), csrfToken, {
      httpOnly: false,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict',
      path: '/',
    });
    return { csrfToken };
  }

  @Post('logout')
  async logout(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const token = req.cookies[sessionCookieName()];
    if (token) await this.sessions.revokeByToken(token);
    clearSessionCookies(res);
    return { ok: true };
  }

  @Patch('me')
  @UseGuards(SessionAuthGuard)
  async updateMe(@Body(new ZodValidationPipe(ProfileSchema)) body: z.infer<typeof ProfileSchema>, @Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    return { user: await this.auth.updateProfile(principal.userId, body) };
  }

  @Get('me')
  async me(@Req() req: FastifyRequest) {
    const token = req.cookies[sessionCookieName()];
    if (!token) throw new UnauthorizedException();
    const session = await this.sessions.resolve(token);
    const verifiedIdentity = await this.auth.identityVerificationSummary(session.user.id);
    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        givenName: session.user.givenName,
        familyName: session.user.familyName,
        status: session.user.status,
        emailVerifiedAt: session.user.emailVerifiedAt,
        phoneVerifiedAt: session.user.phoneE164 ? session.user.phoneVerifiedAt : null,
        contactVerified: contactVerified(session.user),
        identityVerificationStatus: verifiedIdentity,
        transactionPinStatus: await this.pin.status(session.userId),
      },
      roles: session.user.roleAssignments.map((assignment) => assignment.role.code),
      permissions: [...new Set(session.user.roleAssignments.flatMap((assignment) => assignment.role.permissions.map((item) => item.permission.code)))],
      mfaSatisfied: isRecentMfaAssurance(session.mfaSatisfiedAt, Number(process.env['MFA_STEP_UP_MAX_AGE_SECONDS'] ?? 600)),
    };
  }
}
