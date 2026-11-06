import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

// Regression tests for customer-UI findings of the product walkthrough (docs/issues/WALKTHROUGH_FINDINGS_2026-11-04.md).

const root = new URL('../../../apps/customer-ui/src/', import.meta.url).pathname;
const read = (file) => readFileSync(join(root, file), 'utf8');
const require = createRequire(import.meta.url);

function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

// Finds the end of a JSX tag that starts at `from`, skipping `>` inside braces or quotes (arrow functions, strings).
function tagEnd(text, from) {
  let depth = 0;
  let quote = null;
  for (let i = from; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) { if (ch === quote && text[i - 1] !== '\\') quote = null; }
    else if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    else if (ch === '>' && depth === 0) return i;
  }
  return -1;
}

test('WT-05: the add-funds and withdraw pages say "Enter the details", not "Entire"', () => {
  assert.match(read('components/dashboard/add-funds/EnterAmount.tsx'), /Enter the details below to add funds/);
  assert.match(read('components/dashboard/withdraw-funds/RecipientDetails.tsx'), /Enter the details below to withdraw funds/);
  for (const file of sourceFiles(root)) assert.doesNotMatch(readFileSync(file, 'utf8'), /Entire the details/, file);
});

test('WT-06: the sidebar and header show initials instead of an <img src=""> when there is no photo', async () => {
  for (const file of ['components/dashboard/sidebar/SidebarFooter.tsx', 'components/dashboard/DashboardHeader.tsx']) {
    const source = read(file);
    assert.match(source, /<UserAvatar /, file);
    assert.doesNotMatch(source, /avatar\s*\|\|\s*""/, file);
  }
  const ts = require('typescript');
  const source = read('components/dashboard/UserAvatar.tsx');
  const start = source.indexOf('export function initialsOf');
  const end = source.indexOf('type UserAvatarProps');
  const js = ts.transpileModule(source.slice(start, end), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const { initialsOf } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
  assert.equal(initialsOf('Ada', 'Okafor'), 'AO');
  assert.equal(initialsOf(' ada', undefined), 'A');
  assert.equal(initialsOf('', ''), '?');
});

test('WT-06: the sidebar hides the "@" line when the account has no username', () => {
  const source = read('components/dashboard/sidebar/SidebarFooter.tsx');
  assert.doesNotMatch(source, /@\{user\?\.username\}/);
  assert.match(source, /user\?\.username \?/);
});

test('WT-13: every <img> has an alt attribute (empty for decorative images)', () => {
  const missing = [];
  for (const file of sourceFiles(root)) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/<img\b/g)) {
      const end = tagEnd(text, match.index + 4);
      if (end > 0 && !/\balt\s*=/.test(text.slice(match.index, end + 1))) missing.push(file);
    }
  }
  assert.deepEqual(missing, []);
});

test('WT-14: the sidebar log-out button has an accessible name', () => {
  assert.match(read('components/dashboard/sidebar/SidebarFooter.tsx'), /aria-label="Sign out"/);
});

test('WT-15: each contact form label points at a field that exists', () => {
  const source = read('components/external-pages/contact-us-page/ContactUsForm.tsx');
  const targets = [...source.matchAll(/htmlFor="([^"]+)"/g)].map((m) => m[1]).filter((id) => id !== 'terms');
  assert.equal(new Set(targets).size, targets.length, 'labels must not share a target');
  for (const id of targets) assert.ok(source.includes(`id="${id}"`) || source.includes(`id: "${id}"`), `no field has id ${id}`);
});

test('WT-19: dialogs and the filter drawer have an accessible name', () => {
  assert.match(read('components/ui/sheet.tsx'), /aria-label="Panel"/);
  assert.match(read('components/dashboard/history/Filterbutton.tsx'), /aria-label="Filter transactions"/);
});

test('WT-20: the primary heading on each sign-in and sign-up screen is an <h1>', () => {
  for (const file of ['components/Authentication/LogInForm.tsx', 'components/Authentication/SignUpForm.tsx', 'routes/auth-pages/TwoFAOtp.tsx', 'routes/auth-pages/UserDetails.tsx', 'routes/auth-pages/VerifyPhone.tsx']) {
    const source = read(file);
    assert.match(source, /<h1 className="text-4xl/, file);
    assert.doesNotMatch(source, /<h2 className="text-4xl text-\[#101828\] font-medium">/, file);
  }
});

// WT-07: the logo image read "erhapay" while the copy said TwiPay. The brand is now one config file (name, operator, optional picture
// logo) that the logo, the receipt and the footer read, so it can be changed in one place.
test('WT-07: the brand lives in one config and the logo, receipt and footer use it', () => {
  const brand = read('config/brand.ts');
  assert.match(brand, /name: "TwiPay"/);
  assert.match(brand, /logoImage: null/);
  const logo = read('components/navbar/Logo.tsx');
  assert.match(logo, /from "@\/config\/brand"/);
  assert.doesNotMatch(logo, /\.png/);
  const receipt = read('components/receipt/DesktopReceipt.tsx');
  assert.match(receipt, /<BrandMark \/>/);
  assert.doesNotMatch(receipt, /logo\.png/);
  const footer = read('components/footer/Footer.tsx');
  assert.match(footer, /\{brand\.name\}/);
  assert.doesNotMatch(footer, /© 2026 TwiPay/);
});

test('WT-07: the favicon is a brand-neutral file, not the ErhaPay picture', () => {
  const html = readFileSync(join(root, '..', 'index.html'), 'utf8');
  // An inline data URI, so no new image file has to be added to the frozen visual-asset baseline.
  assert.match(html, /rel="icon"[^>]*href="data:image\/svg\+xml,/);
  assert.doesNotMatch(html, /Erhapay-logo/);
});

// WT-11 / WT-12: the FAQ page had no questions ("No FAQs available") and the contact form cannot send. Both are hidden until they
// have real content and a working inbox: no menu or footer link, no link from the sign-in or support pages, and their addresses
// redirect instead of rendering the page.
test('WT-11 / WT-12: the FAQ and contact pages are hidden', () => {
  const constants = read('lib/constants.ts');
  assert.doesNotMatch(constants, /href: "\/contact"|href: "\/faqs"/);
  assert.doesNotMatch(constants, /title: "FAQs"/);
  assert.doesNotMatch(read('components/Authentication/LogInForm.tsx'), /\/faqs/);
  assert.doesNotMatch(read('routes/dashboard/foundations/SupportCentre.tsx'), /settings\/faqs/);
  const app = read('App.tsx');
  assert.doesNotMatch(app, /import ContactPage|import Faq\b|import Faqs\b/);
  for (const [path, target] of [['/contact', '/'], ['/faqs', '/'], ['settings/faqs', '/dashboard/settings']]) {
    assert.match(app, new RegExp(`path: "${path}",\\s*element: <Navigate to="${target}" replace />`), path);
  }
});

// Hiding the contact page left the privacy policy with no link (the contact form was the only one), so the footer carries it.
test('the privacy policy stays reachable from the footer', () => {
  assert.match(read('components/footer/Footer.tsx'), /to="\/privacy-policy"[^>]*>Privacy policy<\/Link>/);
});

// WT-16: colour contrast. The walkthrough's axe scan found 383 grey captions (#727884, 4.4:1 on white, 4.2:1 on the page grey) and
// 6 red error messages (#fb2c36, 3.8:1). Text needs 4.5:1; #667085 and Tailwind red-600 (#e7000b) both clear it on white and #f9fafb.
test('WT-16: caption grey and error red meet 4.5:1 on white and the page grey', () => {
  const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  for (const fg of ['#667085', '#e7000b']) for (const bg of ['#ffffff', '#f9fafb']) assert.ok(ratio(fg, bg) >= 4.5, `${fg} on ${bg}`);
  const offenders = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(name) && /text-\[#727884\]|\btext-red-500\b/.test(readFileSync(full, 'utf8'))) offenders.push(full.slice(root.length));
    }
  })(root);
  assert.deepEqual(offenders, []);
});
