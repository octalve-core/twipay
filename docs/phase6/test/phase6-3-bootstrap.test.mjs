import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'../../..');
const src=readFileSync(resolve(root,'.github/workflows/phase6-3-dependency-bootstrap.yml'),'utf8');
const rootPackage=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));

test('Phase 6.3 lockfile bootstrap is opt-in, read-only, non-deploying and provider-disabled',()=>{
 assert.match(src,/workflow_dispatch:/);
 assert.match(src,/contents: read/);
 assert.doesNotMatch(src,/contents: write|^  push:|^  pull_request:|uses: .*deploy|name: Deploy/mi);
 for (const flag of ['HIGH_RISK_FEATURES_RELEASE_QUALIFIED','WALLET_COLLECTIONS_SANDBOX_ENABLED','BANK_TRANSFERS_SANDBOX_ENABLED','VIRTUAL_ACCOUNTS_SANDBOX_ENABLED','BILL_PURCHASES_SANDBOX_ENABLED','EVENT_CHECKOUT_SANDBOX_ENABLED','EVENT_TICKET_QR_SANDBOX_ENABLED']) {
  assert.match(src,new RegExp(`${flag}: 'false'`),flag);
 }
 assert.match(src,/persist-credentials: false/);
 assert.match(src,/Refuse provider credentials/);
 assert.match(src,/production and all money-moving\/provider and QR gates remain unapproved/);
});

test('Phase 6.3 generates genuine lockfile only on network runner and proves a frozen install',()=>{
 assert.equal(rootPackage.packageManager,'pnpm@12.9.1');
 assert.match(src,/node-version-file: \.node-version/);
 assert.match(src,/test "\$\(pnpm --version\)" = "\$expected"/);
 assert.match(src,/test ! -f pnpm-lock.yaml/);
 assert.match(src,/pnpm install --lockfile-only --ignore-scripts --no-frozen-lockfile/);
 assert.match(src,/phase1-3-preflight\.mjs --check-lock/);
 assert.match(src,/pnpm install --frozen-lockfile/);
 assert.match(src,/sha256sum pnpm-lock.yaml/);
 assert.match(src,/if: always\(\)/);
 assert.match(src,/name: phase63-authentic-lockfile-and-build-evidence/);
 assert.ok(!existsSync(resolve(root,'pnpm-lock.yaml')),'Never commit an invented lockfile in the offline checkpoint');
});

test('Phase 6.3 qualification actually executes semantic builds, migrations and database worker tests on disposable versions',()=>{
 assert.match(src,/image: postgres:18-alpine/);
 assert.match(src,/image: redis:8-alpine/);
 for (const cmd of [
  'pnpm db:generate',
  'prisma:validate',
  'prisma:deploy',
  'pnpm --filter @twipay/database test',
  'pnpm typecheck',
  'pnpm lint',
  'pnpm build',
  'pnpm test:betting-bundle',
  'pnpm test:repo',
  'pnpm test:offline-regression',
  'pnpm test',
  'pnpm --filter @twipay/worker test:integration',
  'playwright test --config playwright.customer-ui.config.ts --list',
 ]) assert.ok(src.includes(cmd),`Missing actual execution of ${cmd}`);
 assert.match(src,/set -euo pipefail/);
 assert.match(src,/if: success\(\)/);
 assert.match(src,/if: always\(\)/);
});

test('Existing CI still refuses to proceed without reviewed authentic lockfile',()=>{
 const ci=readFileSync(resolve(root,'.github/workflows/ci.yml'),'utf8');
 const qa=readFileSync(resolve(root,'.github/workflows/phase6-qualification.yml'),'utf8');
 for(const text of [ci,qa]){
  assert.match(text,/phase1-3-preflight\.mjs --check-lock/);
  assert.match(text,/pnpm install --frozen-lockfile/);
 }
});
