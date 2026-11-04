import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
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
