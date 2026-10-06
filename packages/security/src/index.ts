export const SESSION_COOKIE_PRODUCTION = '__Host-twipay_session';
export const SESSION_COOKIE_LOCAL = 'twipay_session';
export const CSRF_COOKIE_PRODUCTION = '__Host-twipay_csrf';
export const CSRF_COOKIE_LOCAL = 'twipay_csrf';

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
export const SESSION_IDLE_TTL_SECONDS = 60 * 60 * 24;

export const passwordPolicy = Object.freeze({
  minLength: 12,
  maxLength: 128,
});

export function validatePasswordPolicy(password: string): readonly string[] {
  const failures: string[] = [];
  if (password.length < passwordPolicy.minLength) failures.push('PASSWORD_TOO_SHORT');
  if (password.length > passwordPolicy.maxLength) failures.push('PASSWORD_TOO_LONG');
  return failures;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAllowedBrowserOrigin(origin: string | undefined, allowedOrigins: readonly string[]): boolean {
  if (!origin) return false;
  return allowedOrigins.includes(origin);
}

export function isUnsafeMethod(method: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

export const SENSITIVE_LOG_PATHS = Object.freeze([
  'req.headers.authorization',
  'req.headers.cookie',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.sessionToken',
  '*.bvn',
  '*.nin',
  '*.cardNumber',
  '*.cvv',
  '*.secret',
  '*.apiKey',
]);
