import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inspectWorkspace, inspectLockfile, getSourceGates, workspacePackages } from '../../../scripts/qualification/phase1-3-preflight.mjs';
const base = resolve(import.meta.dirname,'../../..');
const source = (p) => readFileSync(resolve(base,p),'utf8');

test('workspace includes every actual application including ErhaPay customer UI and all providers', () => {
  const paths=workspacePackages(base);
  for (const path of ['apps/customer-ui','apps/api','apps/admin','apps/web','apps/worker','packages/database','packages/providers/payments/paystack','packages/providers/payments/monnify']) assert.ok(paths.includes(path), path);
  assert.ok(paths.length>=19);
});
test('every workspace package has a unique name and all local package dependencies resolve',()=>{
  const result=inspectWorkspace(base);
  assert.deepEqual(result.errors,[]);
  assert.equal(new Set(result.names).size,result.paths.length+1);
});
test('the developer reference lockfile is rejected as incomplete',()=>{
  const check=inspectLockfile(source('docs/integration/developer-export-lockfile.reference.yaml'),workspacePackages(base));
  assert.equal(check.valid,false);
  assert.deepEqual(check.missing,['apps/customer-ui']);
});
test('lockfile structural inspection detects complete importer coverage and missing importers',()=>{
  const paths=workspacePackages(base);
  const full=`lockfileVersion: '9.0'\nimporters:\n  .:\n${paths.map(p=>`  '${p}':\n`).join('')}packages:\n`;
  assert.equal(inspectLockfile(full,paths).valid,true);
  const incomplete=full.replace(`  'apps/customer-ui':\n`,'');
  assert.equal(inspectLockfile(incomplete,paths).valid,false);
});
test('root pnpm lockfile must cover every workspace whenever it is present',()=>{
  const file=resolve(base,'pnpm-lock.yaml');
  const gate=getSourceGates(base).gates.find(g=>g.name==='Root lockfile importer coverage');
  if(!existsSync(file)) assert.equal(gate.status,'BLOCKED');
  else {
    const result=inspectLockfile(readFileSync(file,'utf8'),workspacePackages(base));
    assert.equal(result.valid,true);
    assert.equal(gate.status,'PASS');
  }
});
test('Prisma client and CLI are pinned coherently with existing migration sources',()=>{
  const checks=getSourceGates(base);
  assert.equal(checks.gates.find(g=>g.name==='Prisma 7 source configuration').status,'PASS');
  assert.equal(checks.gates.find(g=>g.name==='Migration source completeness').status,'PASS');
  assert.equal(checks.gates.find(g=>g.name==='Original five migration hashes unchanged').status,'PASS');
  assert.ok(checks.migrations.length>=5);
  assert.ok(checks.migrations.every(m=>/^[a-f0-9]{64}$/.test(m.sha256)));
});
test('qualification runtime script is fail-closed for prior provider credentials and uses throwaway database',()=>{
  const script=source('scripts/qualification/phase1-3-run-local.sh');
  assert.match(script,/for key in DATABASE_URL REDIS_URL PAYSTACK_SECRET_KEY/);
  assert.match(script,/local application \.env file detected/);
  assert.match(script,/HIGH_RISK_FEATURES_RELEASE_QUALIFIED=false/);
  assert.match(script,/twipay_qual_test/);
  assert.match(script,/pnpm install --frozen-lockfile/);
  assert.match(script,/prisma:deploy/);
  assert.match(script,/test:integration/);
  assert.match(script,/down --volumes/);
  const compose=source('scripts/qualification/compose.phase1-3.yaml');
  assert.match(compose,/postgres:18-alpine/);
  assert.match(compose,/redis:8-alpine/);
  assert.match(compose,/127\.0\.0\.1:/);
});
test('financial purchase/provisioning flags remain explicitly disabled in sample configuration',()=>{
  const env=source('.env.example');
  for(const key of ['WALLET_COLLECTIONS_SANDBOX_ENABLED','BANK_TRANSFERS_SANDBOX_ENABLED','VIRTUAL_ACCOUNTS_SANDBOX_ENABLED','BILL_PURCHASES_SANDBOX_ENABLED','EVENT_CHECKOUT_SANDBOX_ENABLED','EVENT_TICKET_QR_SANDBOX_ENABLED']) assert.match(env,new RegExp(`${key}=false`));
});
