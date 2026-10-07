import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import {
  SESSION_COOKIE_LOCAL,
  SESSION_COOKIE_PRODUCTION,
  isRecentMfaAssurance,
} from '@twipay/security';
import { SessionService } from '../application/session.service.js';

export interface TwiPayRequestPrincipal {
  userId: string;
  sessionId: string;
  roles: readonly string[];
  permissions: readonly string[];
  mfaSatisfied: boolean;
}

export type AuthenticatedFastifyRequest = FastifyRequest & { twipayPrincipal?: TwiPayRequestPrincipal };

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedFastifyRequest>();
    const cookieName = process.env['NODE_ENV'] === 'production' ? SESSION_COOKIE_PRODUCTION : SESSION_COOKIE_LOCAL;
    const token = req.cookies[cookieName];
    if (!token) throw new UnauthorizedException({ code: 'AUTHENTICATION_REQUIRED' });
    const session = await this.sessions.resolve(token);
    req.twipayPrincipal = {
      userId: session.userId,
      sessionId: session.id,
      roles: session.user.roleAssignments.map((assignment) => assignment.role.code),
      permissions: [...new Set(session.user.roleAssignments.flatMap((assignment) => assignment.role.permissions.map((item) => item.permission.code)))],
      mfaSatisfied: isRecentMfaAssurance(session.mfaSatisfiedAt, Number(process.env['MFA_STEP_UP_MAX_AGE_SECONDS'] ?? 600)),
    };
    return true;
  }
}

export function requirePrincipal(req: AuthenticatedFastifyRequest): TwiPayRequestPrincipal {
  if (!req.twipayPrincipal) throw new UnauthorizedException({ code: 'AUTHENTICATION_REQUIRED' });
  return req.twipayPrincipal;
}
