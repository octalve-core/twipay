import { test, expect } from 'vitest';
import { riskRatePolicy } from '../src/platform/http/risk-rate-limit.ts';

const policy = (method, url) => riskRatePolicy({ method, url });
test('login and registration use restrictive bucket', () => {
  for (const route of ['/v1/auth/login', '/v1/auth/register']) expect(policy('POST', route).bucket).toBe('auth-entry');
});
test('MFA challenges use stricter policy', () => expect(policy('POST', '/v1/auth/mfa/challenge').bucket).toBe('mfa'));
test('real financial transfer route is rate-limited', () => expect(policy('POST', '/v1/finance/transfers').bucket).toBe('transfer'));
test('utility purchases and event checkout hit intended buckets', () => {
  expect(policy('POST', '/v1/services/purchases').bucket).toBe('service-purchase');
  expect(policy('POST', '/v1/events/checkout').bucket).toBe('event-checkout');
});
test('refund and payout routes use the high-risk bucket', () => {
  expect(policy('POST', '/v1/operations/refunds/ref/approve').bucket).toBe('high-risk-money');
  expect(policy('POST', '/v1/operations/customer/events/organizers/org/payouts').bucket).toBe('high-risk-money');
});
test('PATCH privileged mutation cannot fall through default policy', () => {
  expect(policy('PATCH', '/v1/operations/providers/offers/offer').bucket).toBe('admin-operation');
  expect(policy('PATCH', '/v1/product/admin/flags').bucket).toBe('admin-operation');
});
test('GET requests and lookalike routes do not receive elevated-risk bucket', () => {
  expect(policy('GET', '/v1/product/admin/flags').bucket).toBe('default');
  expect(policy('POST', '/v1/finance/transfers-fake').bucket).toBe('default');
});
test('query strings cannot alter route classification', () => {
  expect(policy('POST', '/v1/auth/login?foo=bar').bucket).toBe('auth-entry');
});
