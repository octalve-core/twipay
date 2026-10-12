import { createHmac } from 'node:crypto';

/**
 * Stable for one opaque session; a new session token (login/MFA rotation) yields
 * a different CSRF secret. Domain separation prevents token/key reuse.
 * This is NOT an authentication credential or a replacement for Origin checks.
 */
export function deriveSessionCsrfToken(sessionToken: string, pepper: string): string {
  if (!sessionToken || !pepper || pepper.length < 32) throw new Error('SESSION_CSRF_SECRET_UNAVAILABLE');
  return createHmac('sha256', pepper)
    .update('twipay:session-csrf:v1\0')
    .update(sessionToken)
    .digest('base64url');
}
