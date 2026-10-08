import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../platform/http/zod-validation.pipe.js';
import { MfaService } from '../application/mfa.service.js';
import { SessionAuthGuard, requirePrincipal, type AuthenticatedFastifyRequest } from './session-auth.guard.js';
import { setSessionCookies } from './session-cookie.js';

const EnrollmentSchema = z.object({ password: z.string().min(1).max(128) }).strict();
const ChallengeSchema = z.object({ code: z.string().trim().min(6).max(32) }).strict();
const DisableSchema = ChallengeSchema.extend({ reason: z.string().trim().min(3).max(120).optional() }).strict();

@ApiTags('authentication-mfa')
@UseGuards(SessionAuthGuard)
@Controller('auth/mfa')
export class MfaController {
  constructor(private readonly mfa: MfaService) {}

  @Get('status')
  async status(@Req() req: AuthenticatedFastifyRequest) {
    return { mfa: await this.mfa.status(requirePrincipal(req).userId) };
  }

  @Post('enroll')
  async enroll(
    @Body(new ZodValidationPipe(EnrollmentSchema)) body: z.infer<typeof EnrollmentSchema>,
    @Req() req: AuthenticatedFastifyRequest,
  ) {
    return { enrollment: await this.mfa.beginEnrollment(requirePrincipal(req).userId, body.password) };
  }

  @Post('enroll/confirm')
  async confirm(
    @Body(new ZodValidationPipe(ChallengeSchema)) body: z.infer<typeof ChallengeSchema>,
    @Req() req: AuthenticatedFastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const principal = requirePrincipal(req);
    const result = await this.mfa.confirmEnrollment(principal.userId, principal.sessionId, body.code);
    setSessionCookies(res, result.session);
    return { recoveryCodes: result.recoveryCodes, mfaSatisfied: true };
  }

  @Post('challenge')
  async challenge(
    @Body(new ZodValidationPipe(ChallengeSchema)) body: z.infer<typeof ChallengeSchema>,
    @Req() req: AuthenticatedFastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const principal = requirePrincipal(req);
    const result = await this.mfa.challenge(principal.userId, principal.sessionId, body.code);
    setSessionCookies(res, result.session);
    return { mfaSatisfied: true, method: result.method };
  }

  @Post('recovery-codes/regenerate')
  async regenerateRecoveryCodes(
    @Body(new ZodValidationPipe(ChallengeSchema)) body: z.infer<typeof ChallengeSchema>,
    @Req() req: AuthenticatedFastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const principal = requirePrincipal(req);
    const result = await this.mfa.regenerateRecoveryCodes(principal.userId, principal.sessionId, body.code);
    setSessionCookies(res, result.session);
    return { recoveryCodes: result.recoveryCodes, mfaSatisfied: true };
  }

  @Post('disable')
  async disable(
    @Body(new ZodValidationPipe(DisableSchema)) body: z.infer<typeof DisableSchema>,
    @Req() req: AuthenticatedFastifyRequest,
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const principal = requirePrincipal(req);
    const result = await this.mfa.disable(principal.userId, principal.sessionId, body.code, body.reason);
    setSessionCookies(res, result.session);
    return { disabled: true, mfaSatisfied: false };
  }
}
