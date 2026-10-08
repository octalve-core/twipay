import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decryptSensitiveString,
  encryptSensitiveString,
  fingerprintSensitiveValue,
  isAllowedBrowserOrigin,
  isUnsafeMethod,
  isRecentMfaAssurance,
  buildTotpOtpAuthUri,
  generateRecoveryCodes,
  generateTotpCode,
  hashRecoveryCode,
  normalizeRecoveryCode,
  verifyTotpCode,
  validatePasswordPolicy,
} from '../.test-dist/index.js';

test('password policy rejects short passwords', () => {
  assert.deepEqual(validatePasswordPolicy('short'), ['PASSWORD_TOO_SHORT']);
});

test('origin matching is exact', () => {
  assert.equal(isAllowedBrowserOrigin('https://app.twipay.co', ['https://app.twipay.co']), true);
  assert.equal(isAllowedBrowserOrigin('https://evil.twipay.co.attacker.test', ['https://app.twipay.co']), false);
});

test('unsafe methods are classified for CSRF enforcement', () => {
  assert.equal(isUnsafeMethod('POST'), true);
  assert.equal(isUnsafeMethod('GET'), false);
});

test('session/token anti-pattern marker remains absent from helper behavior', () => {
  assert.equal(isUnsafeMethod('OPTIONS'), false);
});

test('sensitive-value encryption round trips and does not expose plaintext', () => {
  const key = Buffer.alloc(32, 7).toString('base64');
  const encrypted = encryptSensitiveString('12345678901', key);
  assert.equal(encrypted.includes('12345678901'), false);
  assert.equal(decryptSensitiveString(encrypted, key), '12345678901');
});

test('PII fingerprint is deterministic but not plaintext', () => {
  const key = '0123456789abcdef0123456789abcdef';
  const a = fingerprintSensitiveValue('12345678901', key);
  const b = fingerprintSensitiveValue('12345678901', key);
  assert.equal(a, b);
  assert.notEqual(a, '12345678901');
  assert.equal(a.length, 64);
});


test('MFA assurance is bounded by a short step-up window', () => {
  const now = new Date('2026-10-07T00:00:00.000Z');
  assert.equal(isRecentMfaAssurance(new Date('2026-10-06T23:55:00.000Z'), 600, now), true);
  assert.equal(isRecentMfaAssurance(new Date('2026-10-06T23:40:00.000Z'), 600, now), false);
  assert.equal(isRecentMfaAssurance(new Date('2026-10-07T00:01:00.000Z'), 600, now), false);
  assert.equal(isRecentMfaAssurance(null, 600, now), false);
});


test('TOTP follows the RFC 6238 SHA-1 vector', () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  assert.equal(generateTotpCode(secret, 1n, 8), '94287082');
});

test('TOTP verification accepts bounded skew and rejects replayed timesteps', () => {
  const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
  const now = new Date('2026-10-08T08:00:00.000Z');
  const currentStep = BigInt(Math.floor(now.getTime() / 1000 / 30));
  const code = generateTotpCode(secret, currentStep);
  assert.equal(verifyTotpCode({ secretBase32: secret, code, now, window: 1 }), currentStep);
  assert.equal(verifyTotpCode({ secretBase32: secret, code, now, window: 1, lastAcceptedTimeStep: currentStep }), null);
  const previousCode = generateTotpCode(secret, currentStep - 1n);
  assert.equal(verifyTotpCode({ secretBase32: secret, code: previousCode, now, window: 1 }), currentStep - 1n);
  assert.equal(verifyTotpCode({ secretBase32: secret, code: previousCode, now, window: 0 }), null);
});

test('otpauth enrollment URI is standards-compatible without exposing unrelated secrets', () => {
  const uri = buildTotpOtpAuthUri({ issuer: 'TwiPay', accountName: 'person@example.com', secretBase32: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' });
  assert.match(uri, /^otpauth:\/\/totp\/TwiPay:person%40example\.com\?/);
  const parsed = new URL(uri);
  assert.equal(parsed.searchParams.get('issuer'), 'TwiPay');
  assert.equal(parsed.searchParams.get('algorithm'), 'SHA1');
  assert.equal(parsed.searchParams.get('digits'), '6');
  assert.equal(parsed.searchParams.get('period'), '30');
});

test('recovery codes are one-time hashable material and normalization is stable', () => {
  const key = 'mfa-recovery-key-0123456789abcdef0123456789abcdef';
  const codes = generateRecoveryCodes(10);
  assert.equal(codes.length, 10);
  assert.equal(new Set(codes).size, 10);
  for (const code of codes) {
    const normalized = normalizeRecoveryCode(code);
    assert.ok(normalized);
    assert.equal(normalized.length, 16);
    assert.equal(hashRecoveryCode(code, key), hashRecoveryCode(normalized, key));
    assert.equal(hashRecoveryCode(code, key).includes(normalized), false);
  }
});
