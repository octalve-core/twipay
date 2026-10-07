import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('customer API helper uses cookie credentials and CSRF without localStorage auth', () => {
  const source = read('app/_lib/api.ts');
  assert.match(source, /credentials:\s*'include'/);
  assert.match(source, /x-csrf-token/);
  assert.match(source, /idempotency-key/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
  assert.doesNotMatch(source, /authorization['"]?\s*:/i);
});

test('money input conversion is string/BigInt based, not floating point', () => {
  const source = read('app/_lib/api.ts');
  assert.match(source, /parseNgnMajorToMinor/);
  assert.match(source, /BigInt\(major\)/);
  assert.doesNotMatch(source, /Math\.round\s*\(\s*Number/);
});

test('V1 customer surfaces are present', () => {
  for (const path of ['dashboard/page.tsx','wallet/page.tsx','services/page.tsx','events/page.tsx','tickets/page.tsx','organizer/page.tsx','profile/page.tsx','support/page.tsx']) {
    assert.ok(existsSync(new URL(`../app/${path}`, import.meta.url)), path);
  }
});

test('customer financial and identity inputs are not sent through URL query strings', () => {
  const wallet = read('app/wallet/page.tsx');
  const profile = read('app/profile/page.tsx');
  assert.doesNotMatch(wallet, /\?(?:[^`'"\s]*)(?:accountNumber|amount|bankCode)=/);
  assert.doesNotMatch(profile, /\?(?:[^`'"\s]*)(?:bvn|nin|identifier|otp)=/i);
});


test('organizer surface exposes controlled payout request/history without browser-stored provider secrets', () => {
  const source = read('app/organizer/page.tsx');
  assert.match(source, /Request settlement payout/);
  assert.match(source, /payout history/i);
  assert.match(source, /idempotent:\s*true/);
  assert.match(source, /maker\/checker separation/);
  assert.doesNotMatch(source, /SECRET_KEY|API_KEY|accountNumberCiphertext/);
});
