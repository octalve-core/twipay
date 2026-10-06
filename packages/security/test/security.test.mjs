import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function source() { return readFileSync(new URL('../.test-dist/index.js', import.meta.url), 'utf8'); }

async function mod() { return import(new URL('../.test-dist/index.js', import.meta.url)); }

test('password policy rejects short password and accepts long passphrase', async () => {
  const { validatePasswordPolicy } = await mod();
  assert.deepEqual(validatePasswordPolicy('short'), ['PASSWORD_TOO_SHORT']);
  assert.deepEqual(validatePasswordPolicy('correct horse battery staple'), []);
});

test('origin allowlist is exact, not suffix based', async () => {
  const { isAllowedBrowserOrigin } = await mod();
  const allowed = ['https://app.twipay.co'];
  assert.equal(isAllowedBrowserOrigin('https://app.twipay.co', allowed), true);
  assert.equal(isAllowedBrowserOrigin('https://app.twipay.co.attacker.test', allowed), false);
  assert.equal(isAllowedBrowserOrigin(undefined, allowed), false);
});

test('unsafe method classification is deny-by-default', async () => {
  const { isUnsafeMethod } = await mod();
  assert.equal(isUnsafeMethod('POST'), true);
  assert.equal(isUnsafeMethod('DELETE'), true);
  assert.equal(isUnsafeMethod('GET'), false);
});

test('compiled security source does not reference localStorage', () => {
  assert.equal(source().includes('localStorage'), false);
});
