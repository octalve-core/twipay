import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const root = new URL('../../../', import.meta.url);
const text = (p) => readFileSync(new URL(p, root), 'utf8');
const file = (p) => existsSync(new URL(p, root));
test('Prisma 7 adapter imported with no implicit dev-password database', () => {
  const src = text('apps/api/src/platform/database/prisma.service.ts');
  assert.match(src, /new PrismaPg\(\{ connectionString \}\)/);
  assert.match(src, /if \(!connectionString\) throw/);
  assert.doesNotMatch(src, /development_password|local_development_only/);
});
test('Prisma CLI datasource configured outside schema and without a hardcoded fallback', () => {
  const schema = text('packages/database/prisma/schema.prisma');
  const cfg = text('packages/database/prisma.config.ts');
  assert.doesNotMatch(schema, /url\s*=\s*env\(/);
  assert.match(cfg, /process\.env\.DATABASE_URL \?\? ''/);
  assert.doesNotMatch(cfg, /postgresql:\/\//);
});
test('Financial sandbox gates survive developer reconciliation', () => {
  const cfg = text('apps/api/src/platform/config/env.ts');
  const sample = text('.env.example');
  for (const flag of ['WALLET_COLLECTIONS_SANDBOX_ENABLED','BANK_TRANSFERS_SANDBOX_ENABLED','VIRTUAL_ACCOUNTS_SANDBOX_ENABLED','BILL_PURCHASES_SANDBOX_ENABLED','EVENT_CHECKOUT_SANDBOX_ENABLED','EVENT_TICKET_QR_SANDBOX_ENABLED']) {
    assert.ok(cfg.includes(`${flag}: z.enum(['true', 'false']).default('false')`));
    assert.ok(sample.includes(`${flag}=false`));
  }
});
test('Newer event checkout and ticket credential security survives', () => {
  const e = text('apps/api/src/modules/events/application/event.service.ts');
  assert.match(e,/publicCheckoutResponse\(idem\.replay\.body\)/);
  assert.match(e,/EVENT_QUOTE_CHANGED/);
  assert.doesNotMatch(e,/issued\.push\(\{ id: ticket\.id, publicCode, qrPayload:/);
});
test('Newer bank and virtual-account access controls survive', () => {
  assert.match(text('apps/api/src/modules/finance/application/transfer.service.ts'),/BENEFICIARY_NAME_CHANGED/);
  assert.match(text('apps/api/src/modules/finance/application/virtual-account.service.ts'),/listProvisioningForUser/);
});
test('Developer export lockfile not misrepresented as current frozen-lockfile evidence', () => {
  assert.ok(!file('pnpm-lock.yaml'));
  assert.ok(file('docs/integration/developer-export-lockfile.reference.yaml'));
  const d=JSON.parse(text('docs/integration/PHASE1_SOURCE_RECONCILIATION.json'));
  assert.equal(d.baseline.changed,48);assert.equal(d.decisions.length,59);
  assert.equal(d.decisions.filter(x=>x.decision==='PROVENANCE_ONLY_LOCK_INVALID').length,1);
});
test('Original ErhaPay files are preserved', () => {
  const a=JSON.parse(text('docs/integration/ERHAPAY_SOURCE_PRESERVATION.json'));
  assert.equal(a.missing_from_customer_ui.length,0);
  assert.equal(a.changed_visual_assets.length,0);
});
test('Identity decisions explicitly require OIDC and server-side transaction PIN',()=>{
  const d=text('docs/integration/PHASE1_BATCH11_12_IMPLEMENTATION.md');
  assert.match(d,/authorization-code OIDC with PKCE/);
  assert.match(d,/Mandatory transaction PIN/);
  assert.match(d,/no false claim of transaction PIN protection/);
});
