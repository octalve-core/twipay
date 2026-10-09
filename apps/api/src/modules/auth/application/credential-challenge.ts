import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

/** Short-lived email OTPs are never stored in cleartext. Each purpose has its own domain. */
export function challengeDigest(purpose: 'password-enroll' | 'pin-reset', userId: string, sessionId: string, email: string, code: string): string {
  const key = process.env['SESSION_HASH_PEPPER'];
  if (!key || key.length < 32) throw new Error('SESSION_HASH_PEPPER must contain at least 32 characters');
  return createHmac('sha256', key).update(`twipay:${purpose}:v1\0`).update(userId).update('\0').update(sessionId).update('\0').update(email).update('\0').update(code).digest('hex');
}
export function matchesChallenge(actual: string, expected: string): boolean {
  const a = Buffer.from(actual, 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === 32 && b.length === 32 && timingSafeEqual(a, b);
}
export function generateEightDigitCode(): string { return randomInt(0, 100_000_000).toString().padStart(8, '0'); }
export const CHALLENGE_TTL_MS = 10 * 60_000;
export const CHALLENGE_COOLDOWN_MS = 60_000;
export const CHALLENGE_DAILY_LIMIT = 5;
export const CHALLENGE_MAX_ATTEMPTS = 5;
