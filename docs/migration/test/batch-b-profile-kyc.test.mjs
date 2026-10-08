// Static cross-layer contracts only; does not establish live browser/API/provider behaviour.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');
const customer = (p) => read(`apps/customer-ui/${p}`);

test('profile changes match exactly the supported backend contract', () => {
  const api = read('apps/api/src/modules/auth/presentation/auth.controller.ts');
  const frontend = customer('src/lib/api/authApi.ts');
  assert.match(api, /@Patch\('me'\)/);
  assert.match(api, /const ProfileSchema = z\.object\(\{ givenName:/);
  assert.match(api, /familyName: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(100\)/);
  assert.match(frontend, /api\.patch<\{ user: Profile \}>\("\/auth\/me", profile\)/);
});

test('ErhaPay account form uses only supported mutable name fields', () => {
  const form = customer('src/components/dashboard/settings/AccountSettingForm.tsx');
  assert.match(form, /mutationFn: updateProfile/);
  assert.match(form, /givenName: first, familyName: last/);
  assert.match(form, /await refreshSession\(\)/);
  for (const unsupported of ['username', 'country', 'state']) {
    assert.match(form, new RegExp(`<input id="${unsupported}"[^>]*disabled`));
  }
  assert.doesNotMatch(form, /fetchCountries|\/reference\/states\/|accessToken|refreshToken/);
});

test('legacy direct avatar uploader is not active in ErhaPay account settings', () => {
  const page = customer('src/components/dashboard/settings/AccountSettings.tsx');
  assert.match(page, /Change Photo/);
  assert.match(page, /type="button" disabled/);
  assert.doesNotMatch(page, /uploadToImageKit|updateProfileImage|URL\.createObjectURL/);
});

test('KYC API requests mirror backend schemas and require deliberate consent and idempotency', () => {
  const ctrl = read('apps/api/src/modules/kyc/presentation/kyc.controller.ts');
  const client = customer('src/lib/api/kycApi.ts');
  assert.match(ctrl, /@Post\('verifications'\)/);
  assert.match(ctrl, /@Post\('verifications\/:id\/continue'\)/);
  assert.match(ctrl, /@Get\('verifications'\)/);
  assert.match(ctrl, /identifier: z\.string\(\)\.regex\(\/\^\\d\{11\}\$\/\)/);
  assert.match(ctrl, /consent: z\.literal\(true\)/);
  assert.match(ctrl, /'REQUEST_OTP', 'SUBMIT_OTP'/);
  assert.match(client, /consent: true/);
  assert.match(client, /"Idempotency-Key": input\.idempotencyKey/g);
  assert.doesNotMatch(client, /localStorage\.setItem|sessionStorage\.setItem/);
});

test('KYC client is the only new allowlisted path with strict continuation shape', () => {
  const gate = customer('src/lib/api/axios.ts');
  assert.match(gate, /"\/kyc\/verifications"/);
  assert.match(gate, /\^\\\/kyc\\\/verifications\\\/\[0-9a-fA-F-\]\{36\}\\\/continue\$/);
  assert.match(gate, /FEATURE_NOT_INTEGRATED/);
  assert.match(gate, /x-csrf-token/);
});

test('KYC UI requires consent and never caches raw identifiers or invents provider verification methods', () => {
  const screen = customer('src/components/dashboard/settings/IdentityVerificationSettings.tsx');
  assert.match(screen, /type="checkbox"/);
  assert.match(screen, /consent: true/);
  assert.match(screen, /crypto\.randomUUID\(\)/);
  assert.match(screen, /idempotencyKey\(`initiate:/);
  assert.match(screen, /providerMethods\(result\.verificationMethods\)/);
  assert.match(screen, /getIdentityVerifications/);
  assert.match(screen, /setIdentifier\(""\)/);
  assert.doesNotMatch(screen, /localStorage\.setItem|sessionStorage\.setItem|console\.log/);
});

test('Original ErhaPay layout renders account and new verification under the same dashboard settings', () => {
  const routes = customer('src/App.tsx');
  const links = customer('src/lib/constants.ts');
  assert.match(routes, /path: "settings\/account"/);
  assert.match(routes, /path: "settings\/identity-verification"/);
  assert.match(links, /path: "identity-verification"/);
  assert.match(links, /removedProductRoutes = \["\/dashboard\/services\/betting"\]/);
});
