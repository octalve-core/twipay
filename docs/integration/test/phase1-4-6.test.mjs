import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {sourceGates, assetFiles, visualAssetIntegrity, qualification, root} from '../../../scripts/qualification/phase1-4-6-gates.mjs';
import {validateStagingTarget} from '../../../scripts/qualification/check-staging-target.mjs';
import {assertPortsFree} from '../../../scripts/qualification/assert-loopback-ports-free.mjs';
import net from 'node:net';
const read = path => readFileSync(join(root,path),'utf8');

test('new combined source gates pass, but release qualification remains blocked', () => {
  const {gates}=sourceGates();
  assert.ok(gates.length>=10);
  assert.ok(gates.every(g=>g.status==='PASS'),JSON.stringify(gates.filter(g=>g.status!=='PASS')));
  assert.equal(qualification().releaseQualified,false);
  assert.ok(qualification().summary.blocked>=8);
});
test('the real customer UI—not simplified Next—receives Vite E2E and API integration',()=>{
  const ci=read('.github/workflows/browser-e2e.yml');
  assert.match(ci,/pnpm --filter @twipay\/customer-ui preview/);
  assert.doesNotMatch(ci,/pnpm --filter @twipay\/web start/);
  assert.match(ci,/VITE_TWIPAY_API_URL:/);
  assert.match(ci,/pnpm --filter @twipay\/worker start/);
  assert.match(read('playwright.config.ts'),/testMatch: '\*\*\/customer-ui\/\*\.spec\.ts'/);
});
test('old Next-only E2E specifications remain recoverable and are not silently counted',()=>{
  const old=read('tests/e2e/release-security.spec.ts');
  assert.match(old,/auth uses HttpOnly session/);
  assert.match(read('playwright.legacy-web.config.ts'),/release-security\.spec\.ts/);
});
test('financial and ticketing flags are explicitly off in browser CI and local smoke',()=>{
  const ci=read('.github/workflows/browser-e2e.yml');
  const local=read('scripts/qualification/phase1-3-run-local.sh');
  for(const flag of ['WALLET_COLLECTIONS_SANDBOX_ENABLED','BANK_TRANSFERS_SANDBOX_ENABLED','VIRTUAL_ACCOUNTS_SANDBOX_ENABLED','BILL_PURCHASES_SANDBOX_ENABLED','EVENT_CHECKOUT_SANDBOX_ENABLED','EVENT_TICKET_QR_SANDBOX_ENABLED']) {
    assert.match(ci,new RegExp(`${flag}: 'false'`));
    assert.match(local,new RegExp(`${flag}=false`));
  }
});
test('visual asset baseline records every current image from customer source/public',()=>{
  const files=assetFiles();
  const manifest=JSON.parse(read('docs/integration/PHASE14_VISUAL_ASSETS.json'));
  assert.ok(files.length>100);
  const {match, expected, current}=visualAssetIntegrity();
  assert.equal(match,true,'Every original visual asset must match original SHA or the frozen approved SVG-LF SHA');
  assert.deepEqual(expected,manifest);
  assert.deepEqual(current.map(x=>x.file),manifest.map(x=>x.file));
});
test('stack readiness rejects a wrong 200 app shell before any Playwright tests',()=>{
  assert.match(read('scripts/wait-for-stack.mjs'),/isErhaPayCustomerShell/);
  assert.match(read('scripts/stack-readiness.mjs'),/UNEXPECTED_SERVICE_IDENTITY/);
});
test('staging DAST refuses arbitrary hosts, production-like prefixes, credentials and local IPs',()=>{
  const good='https://staging.testing.example';
  assert.equal(validateStagingTarget(good,'staging.testing.example'),good+'/');
  for (const target of ['https://staging.testing.example.evil.com','http://staging.testing.example','https://admin:pass@staging.testing.example','https://staging.testing.example:8443','https://staging.testing.example/?token=x','https://127.0.0.1']) {
    assert.throws(()=>validateStagingTarget(target,'staging.testing.example'));
  }
  assert.throws(()=>validateStagingTarget(good,undefined));
  assert.throws(()=>validateStagingTarget('https://127.0.0.1','127.0.0.1'));
});
test('unused qualification ports pass and occupied ports fail without killing their owners',async()=>{
  const server=net.createServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  try { if(port>=1024) await assert.rejects(()=>assertPortsFree([port]),/QUALIFICATION_PORT_OCCUPIED/); }
  finally { await new Promise(resolve=>server.close(resolve)); }
  await assert.rejects(()=>assertPortsFree([0]),/INVALID_QUALIFICATION_PORTS/);
  await assert.rejects(()=>assertPortsFree([3000,3000]),/INVALID_QUALIFICATION_PORTS/);
});
test('CI includes independent source checks, real database steps and artifact capture',()=>{
  const ci=read('.github/workflows/ci.yml');
  assert.match(ci,/phase1-4-6-gates\.mjs/);
  assert.match(ci,/pnpm --filter @twipay\/database prisma:deploy/);
  assert.match(ci,/pnpm --filter @twipay\/worker test:integration/);
  assert.match(ci,/pnpm install --frozen-lockfile/);
  assert.match(ci,/phase1-source-policy-evidence/);
});
test('read-only E2E tests require real Vite shell and reject anonymous money movement',()=>{
  const spec=read('tests/e2e/customer-ui/phase1-live-boundary.spec.ts');
  assert.match(spec,/#root/);
  assert.match(spec,/\/v1\/payments\/collections/);
  assert.match(spec,/\/v1\/transfers/);
  assert.match(spec,/malicious\.example/);
});
test('unknown CORS origins remain disallowed and unsafe mutations reach the 403 origin guard',()=>{
  const main=read('apps/api/src/main.ts');
  assert.match(main,/return cb\(null, false\)/);
  assert.match(read('apps/api/src/modules/auth/presentation/request-security.guard.ts'),/ORIGIN_NOT_ALLOWED/);
});
