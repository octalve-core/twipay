import { createHmac } from 'node:crypto';

// LOCAL SIMULATOR (labelled as one in the video and the PDF): the authenticator app a person would hold. It turns the
// secret the UI shows during MFA enrolment into the current 6-digit code (RFC 6238, SHA-1, 30 s).
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input: string): Buffer {
  let bits = '';
  for (const character of input.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase()) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error('Invalid base32 secret');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) bytes.push(parseInt(bits.slice(offset, offset + 8), 2));
  return Buffer.from(bytes);
}

export function totp(secretBase32: string, atMs = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(atMs / 1000 / 30)));
  const hmac = createHmac('sha1', base32Decode(secretBase32)).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const value = ((hmac[offset]! & 0x7f) << 24) | (hmac[offset + 1]! << 16) | (hmac[offset + 2]! << 8) | hmac[offset + 3]!;
  return String(value % 1_000_000).padStart(6, '0');
}

// A one-time code may not be used twice, so wait (by the clock, never by what the app shows) for the next 30 s step if this
// secret already used the current one.
const lastStep = new Map<string, number>();

export async function freshCode(page: { waitForTimeout(ms: number): Promise<void> }, secret: string): Promise<string> {
  const step = () => Math.floor(Date.now() / 30_000);
  if (lastStep.get(secret) === step()) await page.waitForTimeout(30_000 - (Date.now() % 30_000) + 1_500);
  lastStep.set(secret, step());
  return totp(secret);
}
