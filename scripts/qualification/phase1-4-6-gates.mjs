#!/usr/bin/env node
/** Source-backed Phase 1.4–1.6 release gates. No provider calls or DB access. */
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, resolve } from 'node:path';

export const root = resolve(import.meta.dirname, '../..');
const read = (path, base = root) => readFileSync(join(base,path),'utf8');
const rule = (name, condition, explanation) => ({ name, status: condition ? 'PASS' : 'FAIL', explanation });
const blocked = (name, explanation) => ({name,status:'BLOCKED',explanation});

export function assetFiles(base = root) {
  const files = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, {withFileTypes:true})) {
      const path=join(dir,entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && /\.(?:png|jpe?g|webp|gif|svg|ico)$/i.test(entry.name)) files.push(relative(base,path).replaceAll('\\','/'));
    }
  };
  walk(join(base,'apps/customer-ui/src/assets'));
  walk(join(base,'apps/customer-ui/public'));
  return files.sort();
}
export function imageHashInventory(base = root) {
  return assetFiles(base).map(file => ({file,sha256:createHash('sha256').update(readFileSync(join(base,file))).digest('hex')}));
}

export function sourceGates(base=root) {
  const workflow=read('.github/workflows/browser-e2e.yml',base);
  const config=read('playwright.config.ts',base);
  const legacy=read('playwright.legacy-web.config.ts',base);
  const rootPackage=JSON.parse(read('package.json',base));
  const customerPackage=JSON.parse(read('apps/customer-ui/package.json',base));
  const workerPackage=JSON.parse(read('apps/worker/package.json',base));
  const readiness=read('scripts/wait-for-stack.mjs',base);
  const stack=read('scripts/stack-readiness.mjs',base);
  const isolated=read('scripts/qualification/phase1-3-run-local.sh',base);
  const api=read('apps/api/src/main.ts',base);
  const customerApp=read('apps/customer-ui/src/App.tsx',base);
  const legacySpecs=existsSync(join(base,'tests/e2e/release-security.spec.ts')) && existsSync(join(base,'tests/e2e/browser-surface.spec.ts'));
  const expectedAssets=JSON.parse(read('docs/integration/PHASE14_VISUAL_ASSETS.json',base));
  const currentAssets=imageHashInventory(base);
  const gates=[
    rule('Real customer app is CI browser target', workflow.includes('pnpm --filter @twipay/customer-ui preview') && !workflow.includes('pnpm --filter @twipay/web start') && /testMatch:\s*['"]\*\*\/customer-ui\/\*\.spec\.ts/.test(config), 'Customer browser gate targets original React/Vite shell; Next reference cannot qualify it.'),
    rule('Customer API URL supplied before Vite build', workflow.includes('VITE_TWIPAY_API_URL: http://127.0.0.1:4000') && workflow.includes('pnpm build') && customerPackage.scripts.preview.includes('vite preview'), 'Vite production bundle receives the locally isolated API URL.'),
    rule('Backend and frontend money gates default off in CI', [
      'VITE_TWIPAY_FUNDING_SANDBOX_ENABLED','VITE_TWIPAY_TRANSFER_SANDBOX_ENABLED','VITE_TWIPAY_VIRTUAL_ACCOUNT_SANDBOX_ENABLED',
      'VITE_TWIPAY_BILLS_SANDBOX_ENABLED','VITE_TWIPAY_EVENT_CHECKOUT_SANDBOX_ENABLED',
      'WALLET_COLLECTIONS_SANDBOX_ENABLED','BANK_TRANSFERS_SANDBOX_ENABLED','VIRTUAL_ACCOUNTS_SANDBOX_ENABLED',
      'BILL_PURCHASES_SANDBOX_ENABLED','EVENT_CHECKOUT_SANDBOX_ENABLED','EVENT_TICKET_QR_SANDBOX_ENABLED',
      'HIGH_RISK_FEATURES_RELEASE_QUALIFIED'
    ].every(name => new RegExp(`^\\s*${name}: 'false'\\s*$`,'m').test(workflow)), 'All customer/provider financial and ticketing switches are explicitly false.'),
    rule('Actual API and reconciliation worker started', workflow.includes('pnpm --filter @twipay/api start') && workflow.includes('pnpm --filter @twipay/worker start') && workerPackage.scripts.start === 'node dist/main.js', 'Browser job starts the real API and worker rather than only static frontends.'),
    rule('Application identity readiness enforced', readiness.includes('isErhaPayCustomerShell') && stack.includes('UNEXPECTED_SERVICE_IDENTITY') && stack.includes('id=["\']root'), 'An unrelated HTTP 200 server cannot pass as ErhaPay-derived customer UI.'),
    rule('Legacy Next-only tests preserved separately', legacySpecs && legacy.includes('browser-surface.spec.ts') && legacy.includes('release-security.spec.ts') && rootPackage.scripts['e2e:legacy-web-reference'], 'Historical test coverage is not silently deleted or misrepresented as customer UI coverage.'),
    rule('ErhaPay visual assets byte-for-byte preserved', expectedAssets.length>100 && JSON.stringify(expectedAssets)===JSON.stringify(currentAssets), `${currentAssets.length} assets match the committed Phase 1.4 SHA-256 baseline.`),
    rule('Local full-stack smoke isolated and fail-closed', isolated.includes('--smoke') && isolated.includes('API_BIND_HOST=127.0.0.1') && isolated.includes('down --volumes') && isolated.includes('VITE_TWIPAY_EVENT_CHECKOUT_SANDBOX_ENABLED=false') && isolated.includes('pnpm e2e') && api.includes("process.env['API_BIND_HOST']"), 'Disposable PostgreSQL/Redis and localhost-only app ports; no provider operations.'),
    rule('Existing event and finance controls retained', customerApp.includes('DeferredFeatureGuard') && existsSync(join(base,'scripts/financial-invariant-check.mjs')) && existsSync(join(base,'scripts/production-hardening-invariant-check.mjs')), 'Finance and deferred route source gates still exist; separate scanners run in CI.'),
    rule('Read-only security browser boundary present', existsSync(join(base,'tests/e2e/customer-ui/phase1-live-boundary.spec.ts')), 'Unauthenticated money requests and untrusted Origin tested against isolated API.'),
  ];
  return {gates,assets:currentAssets.length};
}

export function qualification(base=root) {
  const {gates,assets}=sourceGates(base);
  const all=[...gates,
    blocked('Node 24 / pnpm frozen builds', 'Run actual Node 24.21.0 / pnpm 12.9.1 build from complete genuine lockfile.'),
    blocked('PostgreSQL 18 migrations and concurrency', 'Disposable database-backed finance, locks, virtual account and oversell tests required.'),
    blocked('Redis 8 / BullMQ live recovery', 'Run real job processing, retries and worker shutdown tests.'),
    blocked('Actual ErhaPay browser/visual regressions', 'Run Playwright on real API, worker, React/Vite app and admin; compare approved ErhaPay screenshots.'),
    blocked('Full backend authorization and CSRF concurrency', 'Session CSRF rotation under concurrent browser mutations is not yet addressed in Phase 3.'),
    blocked('External provider sandbox settlement', 'Do not enable or run without separate approved credential-isolated test plan.'),
    blocked('OIDC Google sign-in and mandatory transaction PIN', 'Accepted Phase 3/4 requirements; not implemented or qualified yet.'),
    blocked('Admin RBAC and deployment security', 'Need real role sessions, request-origin/CSP verification and independent DAST.'),
  ];
  return {generatedAt:new Date().toISOString(),assets,sourceHead:'use git rev-parse HEAD for current recorded commit',releaseQualified:false,gates:all,summary:{pass:all.filter(x=>x.status==='PASS').length,fail:all.filter(x=>x.status==='FAIL').length,blocked:all.filter(x=>x.status==='BLOCKED').length}};
}

if (process.argv[1] && resolve(process.argv[1])===resolve(import.meta.filename)) {
  const result=qualification();
  mkdirSync(join(root,'out'),{recursive:true});
  writeFileSync(join(root,'out/phase1-4-6-gates.json'),JSON.stringify(result,null,2)+'\n');
  for(const gate of result.gates) console.log(`${gate.status.padEnd(7)} ${gate.name} — ${gate.explanation}`);
  console.log(`PASS ${result.summary.pass} | FAIL ${result.summary.fail} | BLOCKED ${result.summary.blocked}`);
  if(result.summary.fail || (process.argv.includes('--strict') && result.summary.blocked)) process.exitCode=1;
}
