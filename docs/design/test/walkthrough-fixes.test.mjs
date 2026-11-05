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
