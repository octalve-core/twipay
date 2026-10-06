import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import {
  CSRF_COOKIE_LOCAL,
  CSRF_COOKIE_PRODUCTION,
  SESSION_COOKIE_LOCAL,
  SESSION_COOKIE_PRODUCTION,
  isAllowedBrowserOrigin,
  isUnsafeMethod,
} from '@twipay/security';
import { SessionService } from '../application/session.service.js';

const unauthenticatedMutations = new Set(['/v1/auth/register', '/v1/auth/login']);

@Injectable()
export class RequestSecurityGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    if (!isUnsafeMethod(req.method)) return true;

    const allowedOrigins = [process.env.APP_URL, process.env.ADMIN_URL].filter(
      (value): value is string => Boolean(value),
    );
    const rawOrigin = req.headers.origin;
    const origin = Array.isArray(rawOrigin) ? rawOrigin[0] : rawOrigin;
    if (!isAllowedBrowserOrigin(origin, allowedOrigins)) {
      throw new ForbiddenException({ code: 'ORIGIN_NOT_ALLOWED' });
    }

    const path = req.url.split('?')[0] ?? req.url;
    if (unauthenticatedMutations.has(path)) return true;

    const production = process.env.NODE_ENV === 'production';
    const sessionToken = req.cookies[
      production ? SESSION_COOKIE_PRODUCTION : SESSION_COOKIE_LOCAL
    ];
    const csrfCookie = req.cookies[
      production ? CSRF_COOKIE_PRODUCTION : CSRF_COOKIE_LOCAL
    ];
    const rawHeader = req.headers['x-csrf-token'];
    const csrfHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    if (!sessionToken || !csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      throw new UnauthorizedException({ code: 'CSRF_REQUIRED' });
    }

    const session = await this.sessions.resolve(sessionToken);
    await this.sessions.verifyCsrf(session.id, csrfHeader);
    return true;
  }
}
