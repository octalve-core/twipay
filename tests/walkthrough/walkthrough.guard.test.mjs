import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { RULES, scan } from './guard-rules.mjs';

const here = dirname(fileURLToPath(import.meta.url));

test('the walkthrough folder contains no forbidden actor code', () => {
  assert.deepEqual(scan(here), []);
});

// Tamper test: each rule must actually fire on a file outside the allowlist.
const samples = {
  'api call': "await page.request.get('/x');",
  'database access': "const db = new PrismaClient();",
  'skip or fixme': "test.skip(true, 'x');",
  'visibility guess': "if (await button.isVisible()) {}",
  'try/catch': "try { await a(); } catch {}",
  'browser storage or cookies': "localStorage.clear();",
  'goto outside the wrapper': "await page.goto('/admin');",
  'script injection': "await page.evaluate(() => 1);",
  'fill instead of key presses': "await field.fill('abc');",
};

for (const rule of RULES) {
  test(`tamper: "${rule.name}" is detected`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'wt-guard-'));
    try {
      mkdirSync(join(dir, 'journey'));
      writeFileSync(join(dir, 'journey', 'bad.ts'), `${samples[rule.name]}\n`);
      const findings = scan(dir);
      assert.ok(findings.some((f) => f.includes(rule.name)), `expected a "${rule.name}" finding, got ${JSON.stringify(findings)}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

test('every rule has a tamper sample', () => {
  assert.deepEqual(RULES.map((r) => r.name).sort(), Object.keys(samples).sort());
});
