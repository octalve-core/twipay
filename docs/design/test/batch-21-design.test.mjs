import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const repo = resolve(import.meta.dirname,'../../..');
const read = path => readFileSync(`${repo}/${path}`,'utf8');
const inventory = JSON.parse(read('docs/design/ERHAPAY_COMPONENT_INVENTORY.json'));
const assets = JSON.parse(read('docs/design/ERHAPAY_ORIGINAL_VISUAL_ASSETS.json'));

test('deterministic inventory and original visual-asset integrity check', () => {
 const output = execFileSync(process.execPath,['scripts/design/erhapay-ui-inventory.mjs','--check'],{cwd:repo,encoding:'utf8'});
 assert.match(output,/PASS: design inventory/);
 assert.match(output,/0 material changes/);
});
test('all 123 visual asset paths have frozen source SHA-256 evidence',()=>{
 assert.equal(assets.assets.length,123);
 assert.equal(new Set(assets.assets.map(x=>x.path)).size,123);
 for (const a of assets.assets) {
  assert.match(a.originalSha256,/^[a-f0-9]{64}$/);
  assert.match(a.normalizedSha256,/^[a-f0-9]{64}$/);
  assert.match(a.path,/^(src\/assets\/|public\/)/);
 }
 assert.equal(inventory.visualAssets.materialDifferences,0);
});
test('original layout families remain the design authority',()=>{
 for(const name of ['AuthLayout.tsx','DashboardLayout.tsx','MainLayout.tsx','ReceiptLayout.tsx'])
  assert.ok(inventory.layouts.some(x=>x.endsWith('/'+name)));
 assert.match(read('apps/customer-ui/src/routes/layout/DashboardLayout.tsx'),/max-w-\[1440px\]/);
 assert.match(read('apps/customer-ui/src/routes/layout/DashboardLayout.tsx'),/md:block/);
});
test('original typography, palette and page layout are intact',()=>{
 assert.match(read('apps/customer-ui/src/index.css'),/font-family: "Aeonik"/);
 assert.match(read('apps/customer-ui/src/index.css'),/--color-primary: #112929/);
 assert.match(read('apps/customer-ui/src/routes/dashboard/SettingsPage.tsx'),/max-w-\[588px\]/);
 assert.match(read('apps/customer-ui/src/components/dashboard/settings/Settings.tsx'),/border-\[#F0F2F5\]/);
});
test('new optional ErhaPay primitives reuse the actual settings typography and panels',()=>{
 const x=read('apps/customer-ui/src/components/design-system/ErhaPagePrimitives.tsx');
 for (const name of ['ErhaPageFrame','ErhaPageHeading','ErhaSettingsPanel'])assert.match(x,new RegExp(`export function ${name}\\b`));
 assert.match(x,/max-w-\[588px\]/);
 assert.match(x,/text-\[#112929\]/);
 assert.match(x,/border-\[#F0F2F5\]/);
 assert.match(x,/Authentication\/BackButton/);
 assert.doesNotMatch(x,/fetch\(|axios|localStorage|useEffect|apps\/web|\bpassword\b|\bPIN\b/i);
});
test('existing customer routes and financial feature guards remain in place',()=>{
 const appRouter=read('apps/customer-ui/src/App.tsx');
 assert.match(appRouter,/isDeferredOrExcludedRoute/);
 assert.match(appRouter,/InactiveAuthGuard/);
 assert.match(appRouter,/DashboardLayout/);
 assert.equal(inventory.routes.paths.length,67);
 assert.match(appRouter,/path: "event-check-in"/); // Authorized QR check-in is an additive ErhaPay foundation.
 assert.match(appRouter,/path: "google-complete"/); // The additive OIDC callback completion route is intentional.
});
test('existing interaction controls reused rather than replaced',()=>{
 assert.ok(inventory.components.ui.some(x=>x.endsWith('/dialog.tsx')));
 assert.ok(inventory.components.ui.some(x=>x.endsWith('/table.tsx')));
 assert.match(read('apps/customer-ui/src/components/CustomButton.tsx'),/variant = "secondary"/);
 assert.match(read('apps/customer-ui/src/components/dashboard/EmptyState.tsx'),/EmptyStateImg/);
});
test('design audit documents blocked runtime and Phase 3 authentication requirements',()=>{
 const doc=read('docs/design/ERHAPAY_DESIGN_INVENTORY.md');
 assert.match(doc,/Google OIDC/);
 assert.match(doc,/transaction PIN/i);
 assert.match(doc,/BLOCKED/);
 assert.match(doc,/not.*?browser|Browser.*?not/i);
});
