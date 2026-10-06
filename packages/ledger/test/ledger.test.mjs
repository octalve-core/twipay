import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accountBalanceDelta,
  assertBalanced,
  assertFinancialTransition,
  assertHoldTransition,
  calculateAvailableBalance,
  validateIdempotencyKey,
} from '../.test-dist/index.js';

test('balanced journals are accepted', () => {
  assert.doesNotThrow(() => assertBalanced([
    { accountId: 'wallet', side: 'DEBIT', amountMinor: 10_000n, currency: 'NGN' },
    { accountId: 'clearing', side: 'CREDIT', amountMinor: 10_000n, currency: 'NGN' },
  ]));
});

test('unbalanced journals are rejected', () => {
  assert.throws(() => assertBalanced([
    { accountId: 'wallet', side: 'DEBIT', amountMinor: 10_000n, currency: 'NGN' },
    { accountId: 'clearing', side: 'CREDIT', amountMinor: 9_999n, currency: 'NGN' },
  ]), /unbalanced journal/);
});

test('liability normal balance increases on credit and decreases on debit', () => {
  assert.equal(accountBalanceDelta('CREDIT', { side: 'CREDIT', amountMinor: 2_000n }), 2_000n);
  assert.equal(accountBalanceDelta('CREDIT', { side: 'DEBIT', amountMinor: 500n }), -500n);
});

test('financial status machine rejects terminal-state mutation', () => {
  assert.doesNotThrow(() => assertFinancialTransition('UNKNOWN', 'SUCCEEDED'));
  assert.throws(() => assertFinancialTransition('FAILED', 'SUCCEEDED'), /invalid financial transaction transition/);
});

test('hold status machine is one-way', () => {
  assert.doesNotThrow(() => assertHoldTransition('ACTIVE', 'CAPTURED'));
  assert.throws(() => assertHoldTransition('CAPTURED', 'ACTIVE'), /invalid wallet hold transition/);
});

test('available balance subtracts active holds', () => {
  assert.equal(calculateAvailableBalance(50_000n, 12_500n), 37_500n);
});

test('idempotency key format is constrained', () => {
  assert.equal(validateIdempotencyKey('order:0123456789abcdef'), 'order:0123456789abcdef');
  assert.throws(() => validateIdempotencyKey('short'), /16-128/);
});
