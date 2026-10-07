import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertDisputeTransition,
  assertFeatureKey,
  assertFullRefund,
  assertHexColor,
  assertMakerChecker,
  assertOrganizerPayoutTransition,
  assertPayoutAmount,
  assertRefundTransition,
  calculateAvailableSettlement,
} from '../.test-dist/index.js';

test('maker/checker must be different people', () => {
  assert.doesNotThrow(() => assertMakerChecker('maker', 'checker'));
  assert.throws(() => assertMakerChecker('same', 'same'), /different users/);
});

test('organizer payout state machine does not bypass approval', () => {
  assert.doesNotThrow(() => assertOrganizerPayoutTransition('REQUESTED', 'PENDING_APPROVAL'));
  assert.doesNotThrow(() => assertOrganizerPayoutTransition('PENDING_APPROVAL', 'APPROVED'));
  assert.throws(() => assertOrganizerPayoutTransition('REQUESTED', 'PROVIDER_SUBMITTED'), /invalid organizer payout transition/);
});

test('refund state machine requires review and approval', () => {
  assert.doesNotThrow(() => assertRefundTransition('REQUESTED', 'UNDER_REVIEW'));
  assert.throws(() => assertRefundTransition('REQUESTED', 'SUCCEEDED'), /invalid refund transition/);
});

test('dispute transition is terminal after resolution', () => {
  assert.doesNotThrow(() => assertDisputeTransition('OPEN', 'UNDER_REVIEW'));
  assert.throws(() => assertDisputeTransition('RESOLVED', 'OPEN'), /invalid dispute transition/);
});

test('settlement availability subtracts reservations', () => {
  assert.equal(calculateAvailableSettlement(100_000n, 25_000n), 75_000n);
  assert.equal(calculateAvailableSettlement(10_000n, 20_000n), 0n);
  assert.doesNotThrow(() => assertPayoutAmount(75_000n, 75_000n));
  assert.throws(() => assertPayoutAmount(75_000n, 75_001n), /insufficient/);
});

test('Batch 4 event refunds are full refunds only', () => {
  assert.doesNotThrow(() => assertFullRefund(10_000n, 10_000n));
  assert.throws(() => assertFullRefund(10_000n, 5_000n), /full refunds/);
});

test('feature keys and brand colors use constrained public formats', () => {
  assert.doesNotThrow(() => assertFeatureKey('events.marketplace'));
  assert.throws(() => assertFeatureKey('DROP TABLE'), /invalid feature/);
  assert.doesNotThrow(() => assertHexColor('#5B2A86'));
  assert.throws(() => assertHexColor('purple'), /invalid brand color/);
});
