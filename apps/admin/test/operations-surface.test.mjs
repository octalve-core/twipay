import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('operations API helper uses cookie credentials and CSRF without browser token storage', () => {
  const source = read('app/_lib/api.ts');
  assert.match(source, /credentials:'include'/);
  assert.match(source, /x-csrf-token/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
  assert.doesNotMatch(source, /authorization['"]?\s*:/i);
});

test('required operations surfaces are present', () => {
  for (const path of ['page.tsx','refunds/page.tsx','payouts/page.tsx','providers/page.tsx','compliance/page.tsx','reports/page.tsx','config/page.tsx','audit/page.tsx']) {
    assert.ok(existsSync(new URL(`../app/${path}`, import.meta.url)), path);
  }
});

test('operations payout/refund interfaces do not request raw beneficiary ciphertext', () => {
  const payout = read('app/payouts/page.tsx');
  const refund = read('app/refunds/page.tsx');
  assert.doesNotMatch(payout, /accountNumberCiphertext|identifierCiphertext|fingerprint/i);
  assert.doesNotMatch(refund, /identifierCiphertext|accountNumberCiphertext/i);
});


test('compliance service never selects encrypted identity values or raw provider results', () => {
  const source = readFileSync(new URL('../../api/src/modules/operations/application/compliance.service.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /identifierCiphertext\s*:\s*true|result\s*:\s*true/);
  assert.match(source, /identifierLast4\s*:\s*true/);
});


test('provider operations surface exposes audited routing controls and evidence-backed SKU mapping', () => {
  const source = read('app/providers/page.tsx');
  assert.match(source, /Reset circuit/);
  assert.match(source, /Routing controls/);
  assert.match(source, /Verified canonical SKU mapping/);
  assert.match(source, /verificationNote/);
  assert.doesNotMatch(source, /SECRET_KEY|API_KEY/);
});

test('payout operations surface exposes rejection before checker approval', () => {
  const source = read('app/payouts/page.tsx');
  assert.match(source, /reject/);
  assert.match(source, /Maker\/checker/);
  assert.match(source, /MFA-satisfied/);
});
