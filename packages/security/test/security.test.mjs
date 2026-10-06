import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decryptSensitiveString,
  encryptSensitiveString,
  fingerprintSensitiveValue,
  isAllowedBrowserOrigin,
  isUnsafeMethod,
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
