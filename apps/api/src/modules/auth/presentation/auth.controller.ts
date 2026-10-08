import {
  Body,
  Controller,
  Get,
  Post,
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
import { SessionAuthGuard, requirePrincipal, type AuthenticatedFastifyRequest } from './session-auth.guard.js';
import { SessionService } from '../application/session.service.js';
import { clearSessionCookies, csrfCookieName, sessionCookieName, setSessionCookies } from './session-cookie.js';

const RegisterSchema = z
  .object({
    email: z.email().max(320),
    password: z.string().min(12).max(128),
    givenName: z.string().trim().min(1).max(100).optional(),
    familyName: z.string().trim().min(1).max(100).optional(),
  })
  .strict();
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
  ) {}

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
    return { user: result.user, csrfToken: result.session.csrfToken };
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
    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        givenName: session.user.givenName,
        familyName: session.user.familyName,
        status: session.user.status,
      },
      roles: session.user.roleAssignments.map((assignment) => assignment.role.code),
      permissions: [...new Set(session.user.roleAssignments.flatMap((assignment) => assignment.role.permissions.map((item) => item.permission.code)))],
      mfaSatisfied: isRecentMfaAssurance(session.mfaSatisfiedAt, Number(process.env['MFA_STEP_UP_MAX_AGE_SECONDS'] ?? 600)),
    };
  }
}
