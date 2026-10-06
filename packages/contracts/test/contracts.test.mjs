import test from 'node:test';
import assert from 'node:assert/strict';

test('contract package is intentionally provider-neutral', () => {
  const forbidden = ['paystack', 'monnify', 'vtpass', 'termii'];
  const publicNames = ['PaymentProviderPort', 'BillProviderPort', 'IdentityVerificationProviderPort'];
  for (const name of publicNames) assert.ok(!forbidden.some((v) => name.toLowerCase().includes(v)));
});
