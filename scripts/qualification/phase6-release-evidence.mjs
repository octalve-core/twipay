#!/usr/bin/env node
/**
 * Phase 6 evidence inventory. This script deliberately never approves release.
 * Source, tool and TCP checks are prerequisites only, not operational proof.
 * No external network call, provider request, database write or secret read.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const git = (...args) => {
  try { return execFileSync('git', ['-C', root, ...args], { encoding:'utf8', timeout:5000 }).trim(); }
  catch { return null; }
};
const version = (binary) => {
  try {
    const value = spawnSync(binary, ['--version'], { timeout:5000, encoding:'utf8', stdio:['ignore','pipe','pipe'] });
    return value.status === 0 ? (value.stdout || value.stderr).trim() : null;
  } catch { return null; }
};
const migrationsDir = join(root, 'packages/database/prisma/migrations');
const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const migrationFiles = readdirSync(migrationsDir, { withFileTypes:true })
  .filter(entry => entry.isDirectory() && existsSync(join(migrationsDir, entry.name, 'migration.sql')))
  .map(entry => ({name:entry.name, sha256:sha(join(migrationsDir, entry.name, 'migration.sql'))}))
  .sort((a,b)=>a.name.localeCompare(b.name));
const head = git('rev-parse','HEAD');
const branch = git('branch','--show-current');
const status = git('status','--porcelain');
const expectedPnpm = packageJson.packageManager.split('@').at(-1);
const pnpm = version('pnpm');
const flags = [
 'HIGH_RISK_FEATURES_RELEASE_QUALIFIED', 'WALLET_COLLECTIONS_SANDBOX_ENABLED',
 'BANK_TRANSFERS_SANDBOX_ENABLED','VIRTUAL_ACCOUNTS_SANDBOX_ENABLED',
 'BILL_PURCHASES_SANDBOX_ENABLED','EVENT_CHECKOUT_SANDBOX_ENABLED',
 'EVENT_TICKET_QR_SANDBOX_ENABLED',
];
const enabled = flags.filter(key => process.env[key] === 'true');
const lockExists = existsSync(join(root,'pnpm-lock.yaml'));
const checks = [
 {id:'git-clean',state:head&&branch&&status===''?'PASS':'BLOCKED',detail:head&&branch?`HEAD ${head}; branch ${branch}; ${status===''?'clean':'dirty'}`:'Git not available'},
 {id:'node24',state:process.versions.node.split('.')[0]==='24'?'READY':'BLOCKED',detail:`installed Node ${process.versions.node}; required 24`},
 {id:'exact-pnpm',state:pnpm===expectedPnpm?'READY':'BLOCKED',detail:`installed ${pnpm??'none'}; required ${expectedPnpm}`},
 {id:'genuine-pnpm-lock-present',state:lockExists?'READY':'BLOCKED',detail:lockExists?'Present: independent frozen install still required':'Missing: do not hand-author or copy from obsolete source'},
 {id:'docker-compose',state:version('docker')?'READY':'BLOCKED',detail:version('docker')??'Docker absent; container startup not attempted'},
 {id:'provider-and-money-flags-off',state:enabled.length===0?'PASS':'BLOCKED',detail:enabled.length?`Enabled variables: ${enabled.join(', ')}`:'No dangerous feature switch enabled in this process'},
];
const requirements = [
 ['node24-frozen-build','Real Node 24/pnpm frozen install, TS typecheck, lint and all app builds'],
 ['prisma-postgres18','Prisma 7 generate, validate and apply all migrations to disposable PG18'],
 ['postgres-financial-concurrency','Real ledger holds, transfers, unique/serializable races and reconciliation on PostgreSQL'],
 ['redis8-worker','Real Redis 8 BullMQ retry, idempotency, shutdown and restart'],
 ['auth-mfa-oidc','Actual email receipt, cookie/CSRF and session/MFA/OIDC negative and replay E2E'],
 ['provider-sandbox','Authorized Paystack, Monnify, VTpass and Mono qualification with signed webhooks and reversals'],
 ['browser-erhapay','Original ErhaPay parity, accessiblity, auth, transfer, notification and ticket browser E2E'],
 ['ticket-qr-concurrency','Real ticket issuance/check-in duplicate scans and revocation'],
 ['admin-security-deploy','RBAC, step-up MFA, host/CSP/CORS, DAST, audit and independent approval'],
];
const report={
  type:'TWIPAY_PHASE6_RELEASE_QUALIFICATION_INVENTORY',
  timestamp:new Date().toISOString(),git:{head,branch,clean:status===''},
  declaredPlatform:{node:packageJson.engines.node,pnpm:packageJson.packageManager},
  checks,migrationSourceHashes:migrationFiles,
  runtimeGates:requirements.map(([id,requiredEvidence])=>({id,status:'NOT_QUALIFIED',requiredEvidence})),
  releaseDecision:'NOT_APPROVED',
  warnings:['Source and tool readiness are not equivalent to executed runtime tests.',
    'No production money, account provisioning, ticket sale or QR admission is authorized by this report.',
    'Only an independently reviewed and evidenced release process can approve activation.'],
};
const output=`${JSON.stringify(report,null,2)}\n`;
if(process.env.TWIPAY_PHASE6_REPORT_PATH){
 const path=resolve(process.env.TWIPAY_PHASE6_REPORT_PATH);
 if(!path.startsWith(resolve(root,'out')+'/')) throw new Error('REFUSED: evidence path must be inside repository out/');
 mkdirSync(resolve(root,'out'),{recursive:true});
 writeFileSync(path,output,{flag:'w'});
}
process.stdout.write(output);
if(process.argv.includes('--require-runtime')) process.exitCode=2;
else if(checks.some(x=>x.state==='BLOCKED')) process.exitCode=2;
