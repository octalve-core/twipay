#!/usr/bin/env node
/** Batch F local qualification evidence collector. Does not submit financial operations. */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import net from 'node:net';
import { join, resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const output = join(root, 'docs/qualification');
mkdirSync(output, {recursive:true});
function cmd(binary,args,timeout=45000){
  const r=spawnSync(binary,args,{cwd:root,encoding:'utf8',timeout,env:process.env});
  const excerpt=((r.stdout??'')+'\n'+(r.stderr??'')).trim().split('\n');
  return {exitCode:r.status,error:r.error?.message??null,tail:excerpt.slice(-15).join('\n')};
}
function gate(name,status,evidence){return {name,status,evidence};}
async function tcp(host,port){
  return new Promise(resolve=>{
    const socket=net.createConnection({host,port});
    let done=false;
    function finish(ok){if(done)return;done=true;socket.destroy();resolve(ok)}
    socket.setTimeout(1250);socket.once('connect',()=>finish(true));socket.once('error',()=>finish(false));socket.once('timeout',()=>finish(false));
  });
}
const now=new Date().toISOString();
const git=cmd('git',['rev-parse','HEAD']);
const tests=cmd(process.execPath,['--experimental-strip-types','--test','docs/migration/test/batch-a.test.mjs','docs/migration/test/batch-b-profile-kyc.test.mjs','docs/migration/test/batch-c-wallet-readonly.test.mjs','docs/migration/test/batch-c-transactions.test.mjs','docs/migration/test/batch-c2-funding.test.mjs','docs/migration/test/batch-c3-transfer.test.mjs','docs/migration/test/batch-c4-virtual-accounts.test.mjs','docs/migration/test/batch-d-utilities.test.mjs','docs/migration/test/batch-e-events-operations.test.mjs','docs/qualification/batch-f-ticket-security.test.mjs']);
const scanners=[
  'scripts/typescript-syntax-check.mjs','scripts/repository-security-check.mjs','scripts/architecture-check.mjs','scripts/financial-invariant-check.mjs','scripts/services-events-invariant-check.mjs','scripts/product-operations-invariant-check.mjs','scripts/production-hardening-invariant-check.mjs','scripts/git-history-secret-check.mjs',
].map(file=>({file,result:cmd(process.execPath,[file],45000)}));
const nodeMajor=Number(process.versions.node.split('.')[0]);
const pnpm=cmd('pnpm',['--version'],5000);
const db=await tcp('127.0.0.1',Number(process.env['TWIPAY_POSTGRES_HOST_PORT']??5435));
const redis=await tcp('127.0.0.1',Number(process.env['TWIPAY_REDIS_HOST_PORT']??6382));
const web=await tcp('127.0.0.1',Number(process.env['TWIPAY_CUSTOMER_HOST_PORT']??3002));
const api=await tcp('127.0.0.1',Number(process.env['TWIPAY_API_HOST_PORT']??4000));
const lock=existsSync(join(root,'pnpm-lock.yaml'));
const gates=[
  gate('Batch A–F isolated source/unit tests',tests.exitCode===0?'PASS':'FAIL',tests.tail),
  ...scanners.map(x=>gate(x.file,x.result.exitCode===0?'PASS':'FAIL',x.result.tail)),
  gate('Node 24 toolchain',nodeMajor===24?'PASS':'BLOCKED',`Current Node: ${process.version}`),
  gate('pnpm package manager',pnpm.exitCode===0?'PASS':'BLOCKED',pnpm.exitCode===0?pnpm.tail:'pnpm unavailable'),
  gate('Pinned monorepo lockfile',lock?'PASS':'BLOCKED',lock?'pnpm-lock.yaml present; contents not verified':'pnpm-lock.yaml missing from provisional backend'),
  gate('PostgreSQL 18 integration', 'BLOCKED',db?'TCP is reachable; DB version/schema/races NOT verified':'Port 5435 unreachable; PostgreSQL version/concurrency NOT verified'),
  gate('Redis 8 / BullMQ integration','BLOCKED',redis?'TCP reachable; Redis version/jobs NOT verified':'Port 6382 unreachable'),
  gate('Customer Vite actual build','BLOCKED',`Requires Node 24 / restored dependencies; client port reachable=${web}`),
  gate('API/Admin/Worker actual builds','BLOCKED','Run pnpm install --frozen-lockfile and pnpm build with actual developer checkout'),
  gate('Authenticated Playwright + ErhaPay visual baseline','BLOCKED',`Customer port reachable=${web}, API port reachable=${api}; no browser suite executed by this script`),
  gate('Real PostgreSQL finance concurrency and maker-checker','BLOCKED','No ledger/oversell/duplicate provisioning concurrent DB tests executed'),
  gate('Real provider sandbox settlement and reconciliation','BLOCKED','No financial purchases, transfers, or test provider calls executed'),
  gate('Ticket QR UI and check-in across browsers','BLOCKED','Credential retrieval isolated; QR renderer, staff scanner, concurrent check-in and browser tests not qualified'),
  gate('Latest developer repository reconciliation','BLOCKED','Developer HEAD / ADR 016–018 unverified; must compare with latest Git checkout'),
];
const summary={pass:gates.filter(x=>x.status==='PASS').length,fail:gates.filter(x=>x.status==='FAIL').length,blocked:gates.filter(x=>x.status==='BLOCKED').length};
const data={timestamp:now,gitHead:git.tail.trim(),runtime:{node:process.version,pnpm:pnpm.exitCode===0?pnpm.tail.trim():null,databaseTcp:db,redisTcp:redis,customerTcp:web,apiTcp:api},summary,gates};
writeFileSync(join(output,'BATCH_F_GATE_RESULTS.json'),JSON.stringify(data,null,2)+'\n');
const lines=[`# TwiPay Batch F — Evidence-Based Qualification`, '',`Generated: ${now}`,`Git HEAD at execution: ${data.gitHead}`,`Node: ${process.version}`, '',`**Status: NOT PRODUCTION QUALIFIED**`, '',`PASS ${summary.pass} | FAIL ${summary.fail} | BLOCKED ${summary.blocked}`, '', '| Mandatory gate | Status |', '|---|---|',...gates.map(g=>`| ${g.name.replaceAll('|','/')} | ${g.status} |`),'', 'Blocked gates are not successful tests. TCP reachability alone does not prove a database or API is healthy.', '', '## Source-test evidence', '```text', tests.tail,'```', '', '## Required external qualification', '- Obtain verified developer checkout, ADR 016–018, pinned dependency lockfile and Node 24; reconcile via Git, not overwrite.', '- Restore PostgreSQL 18 and Redis 8, migrate disposable database, test concurrent holds, provider requery, event oversell, payout maker/checker and virtual-account provisioning.', '- Run actual Vite/Nest/Next/worker builds, isolated Playwright customer/admin journeys across all eight requested viewports, compare screenshots against original ErhaPay UI.', '- Execute payment provider sandbox flows and worker reconciliation with verified callbacks; use test-only credentials, never production funds.', '- Add and verify an approved QR encoding library, customer viewer, staff scanner and repeated-check-in tests; keep event checkout and QR reveal disabled meanwhile.', '- Remove or re-encrypt any legacy idempotency response blobs containing a ticket QR credential after a privileged, backed-up DB inventory.', '- Inspect GDPR/NDPA and regulatory, privacy, provider and deployment requirements separately; do not assume a security source scan certifies production.', ''];
writeFileSync(join(output,'BATCH_F_GATE_RESULTS.md'),lines.join('\n'));
console.log(`Batch F qualification: PASS ${summary.pass}, FAIL ${summary.fail}, BLOCKED ${summary.blocked}`);
console.log(`Written docs/qualification/BATCH_F_GATE_RESULTS.{json,md}`);
if(summary.fail)process.exitCode=1;
