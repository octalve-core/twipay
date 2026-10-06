import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertCapacityAvailable,
  assertEventOrderTransition,
  calculatePlatformFeeMinor,
  calculateSettlement,
  createTicketCredential,
  extractTicketPublicCode,
  parseAndVerifyTicketCredential,
} from '../.test-dist/index.js';

test('capacity rejects oversell', () => {
  assert.doesNotThrow(() => assertCapacityAvailable(100, 90, 10));
  assert.throws(() => assertCapacityAvailable(100, 91, 10), /capacity exceeded/);
});

test('event order terminal state cannot move back to paid', () => {
  assert.doesNotThrow(() => assertEventOrderTransition('FUNDS_RESERVED', 'PAID'));
  assert.throws(() => assertEventOrderTransition('FAILED', 'PAID'), /invalid event order transition/);
});

test('basis-point fee uses integer minor-unit floor rounding', () => {
  assert.equal(calculatePlatformFeeMinor(100_00n, 300), 300n);
  assert.equal(calculatePlatformFeeMinor(101n, 100), 1n);
});

test('settlement separates organizer liability from platform fee', () => {
  assert.deepEqual(calculateSettlement({ grossMinor: 10_300n, platformFeeMinor: 300n }), { organizerMinor: 10_000n, platformFeeMinor: 300n });
});

test('ticket credential is opaque, verifiable and tamper evident', () => {
  const key = 'x'.repeat(64);
  const credential = createTicketCredential('TWP-ABCDEFG12345678', key);
  assert.equal(extractTicketPublicCode(credential.qrPayload), 'TWP-ABCDEFG12345678');
  assert.deepEqual(parseAndVerifyTicketCredential(credential.qrPayload, credential.fingerprint, key), { publicCode: 'TWP-ABCDEFG12345678' });
  const tampered = credential.qrPayload.slice(0, -1) + (credential.qrPayload.endsWith('A') ? 'B' : 'A');
  assert.throws(() => parseAndVerifyTicketCredential(tampered, credential.fingerprint, key), /credential mismatch/);
});
