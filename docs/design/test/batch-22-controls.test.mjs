import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../../..');
const source = path => readFileSync(`${root}/apps/customer-ui/src/components/${path}`, 'utf8');
const custom = source('CustomButton.tsx');
const back = source('Authentication/BackButton.tsx');

// These are source-contract tests only; the Playwright browser suite is a separate release gate.
test('CustomButton retains the exact original variant mapping', () => {
  assert.match(custom, /variant = "secondary"/);
  assert.match(custom, /text-\[#475467\] bg-white/);
  assert.match(custom, /text-white bg-\[#112929\]/);
  assert.match(custom, /type = "submit"/);
});
test('link-shaped product buttons cannot navigate when disabled or loading', () => {
  assert.match(custom, /const unavailable = disabled \|\| isLoading/);
  assert.match(custom, /onClick=\{unavailable \? \(event\) => event\.preventDefault\(\) : onClick\}/);
  assert.match(custom, /aria-disabled=\{unavailable \|\| undefined\}/);
  assert.match(custom, /tabIndex=\{unavailable \? -1 : undefined\}/);
});
test('loading product button disables native submissions, without changing default form semantics', () => {
  assert.match(custom, /disabled=\{unavailable\}/);
  assert.match(custom, /aria-busy=\{isLoading \|\| undefined\}/);
  assert.match(custom, /focus-visible:outline-2/);
});
test('icon Back actions are named, non-submit and obey disabled state', () => {
  assert.match(back, /type="button" disabled=\{disabled\} aria-label=\{icon \? "Back"/);
  assert.match(back, /aria-disabled=\{disabled \|\| undefined\}/);
  assert.match(back, /onClick=\{disabled \? \(event\) => event\.preventDefault\(\)/);
  assert.match(back, /alt=""/);
});
test('dashboard mobile navigation is a labelled dialog with distinct open and close names', () => {
  const x = source('dashboard/MobileNavigation.tsx');
  for (const name of ['Open dashboard menu','Close dashboard menu','SheetTitle','SheetDescription']) assert.ok(x.includes(name));
  assert.match(x, /<SheetTrigger asChild>\s*<button[^>]*aria-label="Open dashboard menu"/);
  assert.doesNotMatch(x, /<button[^>]*aria-label="Open dashboard menu"[^>]*onClick=/);
});
test('public mobile navigation is labelled and can scroll on short screens', () => {
  const x = source('navbar/MobileNav.tsx');
  for (const name of ['Open site menu','Close site menu','SheetTitle','SheetDescription','h-dvh overflow-y-auto']) assert.ok(x.includes(name));
  assert.match(x, /navlinks\.map/);
  assert.doesNotMatch(x, /<button className="cursor-pointer">/); // old inert app-store CTA
});
test('anonymous login and signup inputs expose accessible error associations', () => {
  const forms = [
    ['Authentication/LogInForm.tsx', ['email','password']],
    ['Authentication/SignUpForm.tsx', ['firstname','lastname','email','password']],
  ];
  for (const [file,fields] of forms) {
    const x = source(file);
    for (const field of fields) {
      assert.ok(x.includes(`aria-invalid={!!errors.${field}}`), `${file}/${field}: aria-invalid`);
      assert.ok(x.includes(`"${field}-error"`), `${file}/${field}: describedby`);
      assert.ok(x.includes(`id="${field}-error" role="alert"`), `${file}/${field}: error feedback`);
    }
    assert.match(x, /aria-label=\{showPassword \? "Hide password" : "Show password"\}/);
    assert.match(x, /aria-controls="password"/);
  }
});
test('preserved sign-up form includes safe browser autocomplete labels', () => {
  const x = source('Authentication/SignUpForm.tsx');
  for (const name of ['given-name','family-name','email','new-password']) assert.ok(x.includes(`autoComplete="${name}"`));
  assert.doesNotMatch(x, /Referral code \(not yet available\)/);
  assert.match(x, /Get started with TwiPay/);
});
test('unsupported remember-me function is not misrepresented as active', () => {
  const x = source('Authentication/LogInForm.tsx');
  assert.doesNotMatch(x, /Remember for 30 days|remember-unavailable/);
  assert.match(x, /Need help\? Browse FAQs/);
  assert.doesNotMatch(x, /to="\/auth\/reset-password"/);
});
test('decorative UI images have empty alt text; navigational icons are described through their link', () => {
  assert.match(source('dashboard/EmptyState.tsx'), /EmptyStateImg\} alt=""/);
  assert.match(source('SuccessMessage.tsx'), /CheckMark\} alt=""/);
  const header=source('dashboard/DashboardHeader.tsx');
  assert.match(header,/aria-label="Notifications"/);
  assert.match(header,/aria-label="Account settings"/);
  assert.doesNotMatch(header, /VerifiedIcon/); // No fake verified-status badge
});
test('visual baseline screenshot script is nonfinancial, local only and refuses missing reference', () => {
  const x=readFileSync(`${root}/scripts/design/capture-erhapay-public-reference.mjs`,'utf8');
  for(const fragment of ['ERHAPAY_REFERENCE_URL', 'TWIPAY_CUSTOMER_URL', '127.0.0.1','/auth/login','/auth/signup','/about','chromium']) assert.ok(x.includes(fragment));
  assert.doesNotMatch(x,/page\.fill\(|page\.click\(|request\.post\(/);
});
