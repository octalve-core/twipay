import test from 'node:test';
import assert from 'node:assert/strict';
import { riskRatePolicy } from '../src/platform/http/risk-rate-limit.ts';

const policy = (method, url) => riskRatePolicy({ method, url });
test('login and registration use restrictive bucket', () => {
  for (const route of ['/v1/auth/login', '/v1/auth/register']) assert.equal(policy('POST', route).bucket, 'auth-entry');
});
test('MFA challenges use stricter policy', () => assert.equal(policy('POST', '/v1/auth/mfa/challenge').bucket, 'mfa'));
test('real financial transfer route is rate-limited', () => assert.equal(policy('POST', '/v1/finance/transfers').bucket, 'transfer'));
test('utility purchases and event checkout hit intended buckets', () => {
  assert.equal(policy('POST', '/v1/services/purchases').bucket, 'service-purchase');
  assert.equal(policy('POST', '/v1/events/checkout').bucket, 'event-checkout');
});
test('refund and payout routes use the high-risk bucket', () => {
  assert.equal(policy('POST', '/v1/operations/refunds/ref/approve').bucket, 'high-risk-money');
  assert.equal(policy('POST', '/v1/operations/customer/events/organizers/org/payouts').bucket, 'high-risk-money');
});
test('PATCH privileged mutation cannot fall through default policy', () => {
  assert.equal(policy('PATCH', '/v1/operations/providers/offers/offer').bucket, 'admin-operation');
  assert.equal(policy('PATCH', '/v1/product/admin/flags').bucket, 'admin-operation');
});
test('GET requests and lookalike routes do not receive elevated-risk bucket', () => {
  assert.equal(policy('GET', '/v1/product/admin/flags').bucket, 'default');
  assert.equal(policy('POST', '/v1/finance/transfers-fake').bucket, 'default');
});
test('query strings cannot alter route classification', () => {
  assert.equal(policy('POST', '/v1/auth/login?foo=bar').bucket, 'auth-entry');
});
