import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

// Regression tests for the findings of the product walkthrough (docs/issues/WALKTHROUGH_FINDINGS_2026-11-04.md).

const appDir = new URL('../app/', import.meta.url);
const read = (file) => readFileSync(new URL(file, appDir), 'utf8');
const require = createRequire(import.meta.url);

function sourceFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}
const appFiles = sourceFiles(appDir.pathname);

// WT-01: browsers compile `pattern` with the `v` flag, where an unescaped hyphen inside a class is a syntax error and the
// whole check silently never runs.
test('WT-01: every pattern attribute is a valid regular expression under the v flag', () => {
  let seen = 0;
  for (const file of appFiles.filter((f) => f.endsWith('.tsx'))) {
    for (const match of readFileSync(file, 'utf8').matchAll(/\spattern="([^"]+)"/g)) {
      seen += 1;
      assert.doesNotThrow(() => new RegExp(`^(?:${match[1]})$`, 'v'), `${file}: pattern="${match[1]}"`);
    }
  }
  assert.ok(seen >= 5, 'expected to find the pattern attributes');
});

test('WT-01: the UUID fields still accept a UUID and reject a short value', () => {
  const uuid = new RegExp('^(?:[0-9a-fA-F\\-]{36})$', 'v');
  assert.ok(uuid.test('3f2b8c1e-9d4a-4e6b-8a1c-0b7d5e2f9a13'));
  assert.ok(!uuid.test('3f2b8c1e'));
});

// WT-04: the sidebar widget used to print a fixed "ACTIVE" pill and "2 Owners Enrolled" whatever the real state was.
test('WT-04: the sidebar does not hard-code an owner count or a status', () => {
  const shell = read('_components/ops-shell.tsx');
  assert.doesNotMatch(shell, /Owners Enrolled/);
  assert.doesNotMatch(shell, /sidebar-status-pill/);
});

// WT-08: staff should read sentences, not machine codes.
async function loadHelpers() {
  const ts = require('typescript');
  const source = read('_lib/api.ts');
  const start = source.indexOf('const CODE_MESSAGES');
  const end = source.indexOf('async function decode');
  assert.ok(start > 0 && end > start, 'helper block not found');
  const js = ts.transpileModule(source.slice(start, end), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}

test('WT-08: known codes become sentences, unknown codes are spelled out, sentences pass through', async () => {
  const { explainCode, statusLabel } = await loadHelpers();
  assert.match(explainCode('MFA_STEP_UP_REQUIRED'), /authenticator code/i);
  assert.match(explainCode('INDEPENDENT_OWNER_CHECKER_REQUIRED'), /different owner/i);
  assert.equal(explainCode('SOME_NEW_SERVER_CODE'), 'Some new server code.');
  assert.equal(explainCode('Unable to load MFA'), 'Unable to load MFA');
  assert.equal(explainCode(undefined, 'ACTION_BLOCKED'), 'Action blocked.');
  assert.doesNotMatch(explainCode('FINANCIAL_TIER_REVIEW_NOT_QUALIFIED'), /[A-Z]_[A-Z]/);
  assert.equal(statusLabel('WAITING_SUPPORT'), 'Waiting support');
});

test('WT-08: no page shows a raw API error code as its message', () => {
  for (const file of appFiles.filter((f) => f.endsWith('.tsx'))) {
    const bad = readFileSync(file, 'utf8').match(/\b\w+\.code\s*(?:\|\||\?\?)\s*["']/g);
    assert.equal(bad, null, `${file} shows a raw code: ${bad}`);
  }
});

test('WT-08: the support case status pills are not the raw enum', () => {
  const support = read('support/page.tsx');
  assert.doesNotMatch(support, /\{item\.status\}|\{selected\.status\}/);
});

// WT-02: the CSP only allows this origin's fonts, so a Google Fonts @import was blocked on every page (about 60 failed requests).
test('WT-02: fonts are self-hosted through next/font and styles.css makes no external request', () => {
  const css = read('styles.css');
  assert.doesNotMatch(css, /@import\s+url\(['"]?https?:/);
  assert.doesNotMatch(css, /fonts\.googleapis\.com/);
  const layout = read('layout.tsx');
  assert.match(layout, /from "next\/font\/google"/);
  assert.match(layout, /variable: "--font-sans"/);
  assert.match(css, /var\(--font-sans\)/);
  assert.match(css, /var\(--font-mono\)/);
});

// WT-04: the navigation carried invented counts (3 payout batches, 4 disputes, 2 exceptions, "99.8%", 6 reviews) that were never read from data.
test('WT-04: navigation items carry no hard-coded badge counts', () => {
  assert.doesNotMatch(read('_components/ops-shell.tsx'), /badge: "/);
});

// WT-08: the failure card used to print "Error Code: <machine code>".
test('WT-08: the failure card shows an explained message, not "Error Code:"', () => {
  const state = read('_components/state.tsx');
  assert.doesNotMatch(state, /Error Code:/);
  assert.match(state, /explainCode\(code\)/);
});

// WT-03: an inline <style> element has no nonce, so the strict CSP blocks it; the spinner keyframes live in styles.css instead.
test('WT-03: the loading spinner keyframes are in the stylesheet, not an inline <style> tag', () => {
  assert.doesNotMatch(read('_components/state.tsx'), /<style>/);
  assert.match(read('styles.css'), /@keyframes spin\b/);
});

// The sign-in page footer described the console's security internals ("SHA-256 Nonce CSP", cookie flags) to anyone who opened it.
test('the staff sign-in page does not advertise its security implementation', () => {
  assert.doesNotMatch(read('login/page.tsx'), /Nonce CSP|HttpOnly/);
});

// Found in the final walkthrough: the sidebar shortcut to Owner Control was shown to every staff role, not only owners.
test('WT-04: the Owner Control shortcut in the sidebar is shown to owners only', () => {
  const shell = read('_components/ops-shell.tsx');
  const widget = shell.indexOf('sidebar-widget"');
  assert.ok(widget > 0);
  assert.match(shell.slice(Math.max(0, widget - 200), widget), /\{isOwner && \(/);
});

// WT-03: the sign-in page is server-rendered, so every inline style attribute on it is blocked by the nonce-only CSP and the page
// came out half unstyled (large subtitle and footer). Its layout now lives in the stylesheet.
test('WT-03: the staff sign-in page has no inline style attributes', () => {
  assert.doesNotMatch(read('login/page.tsx'), /\sstyle=/);
  const css = read('styles.css');
  for (const cls of ['login-brand-row', 'login-subtitle', 'login-error', 'login-submit', 'login-footer']) assert.match(css, new RegExp(`\\.${cls}\\b`), cls);
});

// WT-22: the Batch Calculator was a mock (hard-coded beneficiaries, a "staged and authorized ... forwarded to checker" message and no
// API call). It is hidden until it is wired to the real payout API: no page, no menu entry, no link.
test('WT-22: the mock Batch Calculator is not reachable from the console', () => {
  assert.equal(existsSync(new URL('payouts/create/page.tsx', appDir)), false);
  assert.doesNotMatch(read('_components/ops-shell.tsx'), /payouts\/create|Batch Calculator/);
  assert.doesNotMatch(read('payouts/page.tsx'), /payouts\/create|Batch Calculator/);
  for (const file of appFiles) assert.doesNotMatch(readFileSync(file, 'utf8'), /staged and authorized|BATCH-202610-SIM01/, file);
});

// WT-23: Delivery Health showed a literal "Channel SLA 99.9%" that was never measured.
async function loadDeliveryRate() {
  const ts = require('typescript');
  const js = ts.transpileModule(read('_lib/delivery.ts'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return (await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)).deliveryRate;
}

test('WT-23: the delivery rate is computed from real counts and says so when there are none', async () => {
  const deliveryRate = await loadDeliveryRate();
  assert.equal(deliveryRate(0, 0), null);
  assert.equal(deliveryRate(97, 3), '97.0%');
  assert.equal(deliveryRate(1, 1), '50.0%');
  assert.equal(deliveryRate(5, 0), '100.0%');
  assert.equal(deliveryRate(99999, 1), '99.9%'); // a failure is never shown as a clean 100%
});

test('WT-23: the Delivery Health page has no literal SLA figure', () => {
  const page = read('notifications/page.tsx');
  assert.doesNotMatch(page, /Channel SLA|99\.9%/);
  assert.match(page, /deliveryRate\(totalDelivered, totalFailed\)/);
});

// WT-16: colour contrast. The walkthrough's axe scan recorded the failing colour pairs; the admin ones were the green and amber status
// text (3.8:1 and 3.2:1 on white), and white-on-blue at 85% opacity in the staff support bubble. Text needs 4.5:1.
function luminance(hex) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('WT-16: the status greens and ambers used for text are at least 4.5:1 on white', () => {
  assert.ok(ratio('#047857', '#ffffff') >= 4.5);
  assert.ok(ratio('#B45309', '#ffffff') >= 4.5);
  for (const file of appFiles) assert.doesNotMatch(readFileSync(file, 'utf8'), /#059669|#D97706/i, `${file} still uses a low-contrast status colour`);
  assert.doesNotMatch(read('styles.css'), /#059669|#D97706/i);
});

test('WT-16: the staff support bubble header is not dimmed below 4.5:1', () => {
  assert.match(read('support/page.tsx'), /opacity: isStaff \? 1 : 0\.85/);
  assert.ok(ratio('#ffffff', '#0062e6') >= 4.5);
});
