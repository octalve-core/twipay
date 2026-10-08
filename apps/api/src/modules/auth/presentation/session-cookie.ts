import type { FastifyReply } from 'fastify';
import {
  CSRF_COOKIE_LOCAL,
  CSRF_COOKIE_PRODUCTION,
  SESSION_COOKIE_LOCAL,
  SESSION_COOKIE_PRODUCTION,
} from '@twipay/security';
import type { SessionMaterial } from '../application/session.service.js';

export function isProductionEnvironment(): boolean {
  return process.env['NODE_ENV'] === 'production';
}

export function sessionCookieName(): string {
  return isProductionEnvironment() ? SESSION_COOKIE_PRODUCTION : SESSION_COOKIE_LOCAL;
}

export function csrfCookieName(): string {
  return isProductionEnvironment() ? CSRF_COOKIE_PRODUCTION : CSRF_COOKIE_LOCAL;
}

export function setSessionCookies(reply: FastifyReply, session: Pick<SessionMaterial, 'token' | 'csrfToken' | 'expiresAt'>): void {
  const secure = isProductionEnvironment();
  reply.setCookie(sessionCookieName(), session.token, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
    expires: session.expiresAt,
  });
  reply.setCookie(csrfCookieName(), session.csrfToken, {
    httpOnly: false,
    secure,
    sameSite: 'strict',
    path: '/',
    expires: session.expiresAt,
  });
}

export function clearSessionCookies(reply: FastifyReply): void {
  const secure = isProductionEnvironment();
  const options = { path: '/', secure, sameSite: 'strict' as const };
  reply.clearCookie(sessionCookieName(), options);
  reply.clearCookie(csrfCookieName(), options);
}
