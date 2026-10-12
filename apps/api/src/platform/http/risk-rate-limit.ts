import type { FastifyRequest } from 'fastify';

export interface RiskRatePolicy {
  readonly bucket: string;
  readonly max: number;
  readonly timeWindowMs: number;
}

const DEFAULT_POLICY: RiskRatePolicy = { bucket: 'default', max: 120, timeWindowMs: 60_000 };

/**
 * Defense in depth only: the default @fastify/rate-limit memory store is scoped
 * to a single API process. A distributed production store/edge gate must be
 * qualified separately; do not treat this as cluster-wide brute-force defense.
 */
export function riskRatePolicy(request: Pick<FastifyRequest, 'method' | 'url'>): RiskRatePolicy {
  const path = request.url.split('?')[0] ?? request.url;
  const method = request.method.toUpperCase();
  const unsafe = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  if (!unsafe) return DEFAULT_POLICY;

  if (method === 'POST' && (path === '/v1/auth/login' || path === '/v1/auth/register')) {
    return { bucket: 'auth-entry', max: 10, timeWindowMs: 60_000 };
  }
  if (path.startsWith('/v1/auth/transaction-pin/')) {
    return { bucket: 'transaction-pin', max: 6, timeWindowMs: 60_000 };
  }
  if (path.startsWith('/v1/auth/google/')) {
    return { bucket: 'google-oidc', max: 6, timeWindowMs: 60_000 };
  }
  if (path.startsWith('/v1/auth/password/reset/')) {
    return { bucket: 'password-recovery', max: 6, timeWindowMs: 60_000 };
  }
  if (path.startsWith('/v1/auth/password/') || path.startsWith('/v1/auth/sessions/')) {
    return { bucket: 'account-security', max: 8, timeWindowMs: 60_000 };
  }
  if (path.startsWith('/v1/auth/contact/')) {
    return { bucket: 'contact-verification', max: 6, timeWindowMs: 60_000 };
  }
  if (path.startsWith('/v1/auth/mfa/')) {
    return { bucket: 'mfa', max: 8, timeWindowMs: 60_000 };
  }
  if (path === '/v1/support/cases' || /^\/v1\/support\/cases\/sup_[0-9a-f-]{36}\/replies$/.test(path)) {
    return { bucket: 'customer-support', max: 8, timeWindowMs: 60_000 };
  }
  if (path.startsWith('/v1/kyc/')) {
    return { bucket: 'kyc', max: 6, timeWindowMs: 60_000 };
  }
  if (/^\/v1\/finance\/transfers(?:\/|$)/.test(path)) {
    return { bucket: 'transfer', max: 12, timeWindowMs: 60_000 };
  }
  if (path === '/v1/services/purchases') {
    return { bucket: 'service-purchase', max: 20, timeWindowMs: 60_000 };
  }
  if (path === '/v1/events/checkout') {
    return { bucket: 'event-checkout', max: 15, timeWindowMs: 60_000 };
  }
  if (path.includes('/refund') || path.includes('/payout')) {
    return { bucket: 'high-risk-money', max: 8, timeWindowMs: 60_000 };
  }
  if (path.startsWith('/v1/operations/') || path.startsWith('/v1/product/admin/')) {
    return { bucket: 'admin-operation', max: 30, timeWindowMs: 60_000 };
  }
  return DEFAULT_POLICY;
}
