import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const TOTP_DIGITS = 6;
export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DEFAULT_WINDOW = 1;

function base32Encode(input: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(value: string): Buffer {
  const normalized = value.trim().replace(/=+$/g, '').toUpperCase();
  if (!normalized || !/^[A-Z2-7]+$/.test(normalized)) throw new Error('INVALID_BASE32_SECRET');
  let bits = 0;
  let accumulator = 0;
  const bytes: number[] = [];
  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error('INVALID_BASE32_SECRET');
    accumulator = (accumulator << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((accumulator >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function safeEqualText(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function generateTotpSecret(bytes = 20): string {
  if (!Number.isInteger(bytes) || bytes < 20 || bytes > 64) throw new Error('INVALID_TOTP_SECRET_LENGTH');
  return base32Encode(randomBytes(bytes));
}

export function totpTimeStep(now = new Date(), periodSeconds = TOTP_PERIOD_SECONDS): bigint {
  if (!Number.isInteger(periodSeconds) || periodSeconds < 15 || periodSeconds > 120) throw new Error('INVALID_TOTP_PERIOD');
  const millis = now.getTime();
  if (!Number.isFinite(millis) || millis < 0) throw new Error('INVALID_TOTP_TIME');
  return BigInt(Math.floor(millis / 1000 / periodSeconds));
}

export function generateTotpCode(secretBase32: string, step: bigint, digits = TOTP_DIGITS): string {
  if (step < 0n) throw new Error('INVALID_TOTP_STEP');
  if (!Number.isInteger(digits) || digits < 6 || digits > 8) throw new Error('INVALID_TOTP_DIGITS');
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(step);
  const digest = createHmac('sha1', base32Decode(secretBase32)).update(counter).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary = ((digest[offset]! & 0x7f) << 24)
    | ((digest[offset + 1]! & 0xff) << 16)
    | ((digest[offset + 2]! & 0xff) << 8)
    | (digest[offset + 3]! & 0xff);
  return String(binary % (10 ** digits)).padStart(digits, '0');
}

export function verifyTotpCode(input: {
  secretBase32: string;
  code: string;
  now?: Date;
  window?: number;
  lastAcceptedTimeStep?: bigint | null;
}): bigint | null {
  const code = input.code.trim();
  if (!/^\d{6}$/.test(code)) return null;
  const window = input.window ?? TOTP_DEFAULT_WINDOW;
  if (!Number.isInteger(window) || window < 0 || window > 2) throw new Error('INVALID_TOTP_WINDOW');
  const current = totpTimeStep(input.now);
  const offsets = [0, -1, 1, -2, 2].filter((offset) => Math.abs(offset) <= window);
  for (const offset of offsets) {
    const step = current + BigInt(offset);
    if (step < 0n) continue;
    if (input.lastAcceptedTimeStep !== null && input.lastAcceptedTimeStep !== undefined && step <= input.lastAcceptedTimeStep) continue;
    if (safeEqualText(generateTotpCode(input.secretBase32, step), code)) return step;
  }
  return null;
}

export function buildTotpOtpAuthUri(input: {
  issuer: string;
  accountName: string;
  secretBase32: string;
}): string {
  const issuer = input.issuer.trim();
  const accountName = input.accountName.trim();
  if (!issuer || !accountName) throw new Error('TOTP_LABEL_REQUIRED');
  base32Decode(input.secretBase32);
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`;
  const query = new URLSearchParams({
    secret: input.secretBase32,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

export function generateRecoveryCodes(count = 10): readonly string[] {
  if (!Number.isInteger(count) || count < 6 || count > 20) throw new Error('INVALID_RECOVERY_CODE_COUNT');
  return Array.from({ length: count }, () => {
    const compact = base32Encode(randomBytes(10));
    return compact.match(/.{1,4}/g)!.join('-');
  });
}

export function normalizeRecoveryCode(code: string): string | null {
  const normalized = code.trim().replace(/[\s-]/g, '').toUpperCase();
  return /^[A-Z2-7]{16}$/.test(normalized) ? normalized : null;
}

export function hashRecoveryCode(code: string, key: string): string {
  if (key.length < 32) throw new Error('MFA_RECOVERY_HMAC_KEY must contain at least 32 characters');
  const normalized = normalizeRecoveryCode(code);
  if (!normalized) throw new Error('INVALID_RECOVERY_CODE');
  return createHmac('sha256', key).update(`twipay-mfa-recovery-v1:${normalized}`).digest('hex');
}
