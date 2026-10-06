import test from 'node:test';
import assert from 'node:assert/strict';
import { assertBillAmount, assertBillPurchaseTransition, chooseRoute, circuitAfterOutcome } from '../.test-dist/index.js';

test('bill purchase transitions are one-way', () => {
  assert.doesNotThrow(() => assertBillPurchaseTransition('UNKNOWN', 'SUCCEEDED'));
  assert.throws(() => assertBillPurchaseTransition('FAILED', 'SUCCEEDED'), /invalid bill purchase transition/);
});

test('bill amount honors fixed and bounded products', () => {
  assert.doesNotThrow(() => assertBillAmount({ amountMinor: 5_000n, fixedAmountMinor: 5_000n }));
  assert.throws(() => assertBillAmount({ amountMinor: 4_999n, fixedAmountMinor: 5_000n }), /fixed/);
  assert.throws(() => assertBillAmount({ amountMinor: 99n, minAmountMinor: 100n }), /minimum/);
  assert.throws(() => assertBillAmount({ amountMinor: 201n, maxAmountMinor: 200n }), /maximum/);
});

test('router excludes open circuits before cooldown', () => {
  const now = new Date('2026-10-06T20:00:00Z');
  const decision = chooseRoute([
    { providerCode: 'a', providerOfferId: 'a1', category: 'DATA', currency: 'NGN', active: true, priority: 10, circuitState: 'OPEN', cooldownUntil: new Date(now.getTime()+60_000) },
    { providerCode: 'b', providerOfferId: 'b1', category: 'DATA', currency: 'NGN', active: true, priority: 1, circuitState: 'CLOSED' },
  ], now);
  assert.equal(decision?.providerCode, 'b');
});

test('router admits cooled-open circuit as a half-open candidate', () => {
  const now = new Date('2026-10-06T20:00:00Z');
  const decision = chooseRoute([
    { providerCode: 'a', providerOfferId: 'a1', category: 'AIRTIME', currency: 'NGN', active: true, priority: 10, circuitState: 'OPEN', cooldownUntil: new Date(now.getTime()-1) },
    { providerCode: 'b', providerOfferId: 'b1', category: 'AIRTIME', currency: 'NGN', active: true, priority: 1, circuitState: 'CLOSED' },
  ], now);
  assert.equal(decision?.providerCode, 'a');
});

test('transient failures open circuit at threshold and success closes it', () => {
  const now = new Date('2026-10-06T20:00:00Z');
  let state = { state: 'CLOSED', consecutiveFailures: 4 };
  state = circuitAfterOutcome(state, 'TRANSIENT_FAILURE', now, 5, 60_000);
  assert.equal(state.state, 'OPEN');
  assert.equal(state.consecutiveFailures, 5);
  assert.deepEqual(circuitAfterOutcome(state, 'SUCCESS', now), { state: 'CLOSED', consecutiveFailures: 0 });
});

test('deterministic business response closes a half-open provider without penalizing it', () => {
  const next = circuitAfterOutcome({ state: 'HALF_OPEN', consecutiveFailures: 5 }, 'DETERMINISTIC_FAILURE');
  assert.deepEqual(next, { state: 'CLOSED', consecutiveFailures: 0 });
});
