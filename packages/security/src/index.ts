import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

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
  '*.identifier',
  '*.otp',
  '*.accountNumber',
  '*.bankAccountNumber',
  '*.validationAccountNumber',
  '*.cardNumber',
  '*.cvv',
  '*.secret',
  '*.apiKey',
]);


function decodeAes256Key(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32) throw new Error('DATA_ENCRYPTION_KEY must decode to exactly 32 bytes');
  return key;
}

/** Encrypts sensitive values for storage. The returned envelope is versioned for future key/format rotation. */
export function encryptSensitiveString(plaintext: string, base64Key: string): string {
  if (!plaintext) throw new Error('Cannot encrypt an empty sensitive value');
  const key = decodeAes256Key(base64Key);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${ciphertext.toString('base64url')}`;
}

export function decryptSensitiveString(envelope: string, base64Key: string): string {
  const [version, ivValue, tagValue, ciphertextValue] = envelope.split('.');
  if (version !== 'v1' || !ivValue || !tagValue || !ciphertextValue) throw new Error('Unsupported encrypted-value envelope');
  const key = decodeAes256Key(base64Key);
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivValue, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, 'base64url')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

/** One-way deterministic identifier used for deduplication/search without storing raw BVN/NIN. */
export function fingerprintSensitiveValue(value: string, fingerprintKey: string): string {
  if (fingerprintKey.length < 32) throw new Error('PII_FINGERPRINT_KEY must contain at least 32 characters');
  return createHmac('sha256', fingerprintKey).update(value).digest('hex');
}
