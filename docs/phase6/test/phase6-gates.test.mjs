import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const root=resolve(import.meta.dirname,'../../..');
const file=(path)=>readFileSync(resolve(root,path),'utf8');
test('CI and local runtime use full latest offline suite, never just historical Phase 1',()=>{
 const pkg=JSON.parse(file('package.json'));
 const command=pkg.scripts['test:offline-regression'];
 for(const pattern of ['docs/phase3/test/*.test.mjs','docs/phase4/test/*.test.mjs','docs/phase5/test/*.test.mjs','apps/admin/test/*.test.mjs']) assert.ok(command.includes(pattern),pattern);
 assert.match(file('.github/workflows/ci.yml'),/pnpm test:offline-regression/);
 assert.match(file('scripts/qualification/phase1-3-run-local.sh'),/pnpm test:offline-regression/);
});
test('evidence inventory records every release gate NOT_QUALIFIED even when source passes',()=>{
 const result=spawnSync(process.execPath,['scripts/qualification/phase6-release-evidence.mjs'],{cwd:root,env:{...process.env,HIGH_RISK_FEATURES_RELEASE_QUALIFIED:'false'},encoding:'utf8'});
 assert.ok([0,2].includes(result.status),result.stderr);
 const report=JSON.parse(result.stdout);
 assert.equal(report.releaseDecision,'NOT_APPROVED');
 assert.equal(report.runtimeGates.length,9);
 assert.ok(report.runtimeGates.every(g=>g.status==='NOT_QUALIFIED'));
 assert.ok(report.git.head);
 assert.equal(report.checks.find(g=>g.id==='provider-and-money-flags-off').state,'PASS');
});
test('evidence inventory refuses release even when all tools are available',()=>{
 const result=spawnSync(process.execPath,['scripts/qualification/phase6-release-evidence.mjs','--require-runtime'],{cwd:root,encoding:'utf8'});
 assert.equal(result.status,2);
 assert.equal(JSON.parse(result.stdout).releaseDecision,'NOT_APPROVED');
});
test('high-risk flags cannot silently pass the Phase 6 safety inventory',()=>{
 const result=spawnSync(process.execPath,['scripts/qualification/phase6-release-evidence.mjs'],{cwd:root,env:{...process.env,EVENT_CHECKOUT_SANDBOX_ENABLED:'true'},encoding:'utf8'});
 assert.equal(result.status,2);
 assert.equal(JSON.parse(result.stdout).checks.find(g=>g.id==='provider-and-money-flags-off').state,'BLOCKED');
});
test('runtime preparation cannot synthesize a lockfile or bypass Node24',()=>{
 const source=file('scripts/qualification/phase1-3-run-local.sh');
 assert.match(source,/pnpm install --lockfile-only --ignore-scripts/);
 assert.match(source,/pnpm install --frozen-lockfile/);
 assert.match(source,/process\.versions\.node\.split/);
 assert.match(source,/down --volumes/);
});

test('Phase 6 workflow is manual, uses isolated test containers and can never approve finance',()=>{
 const workflow=file('.github/workflows/phase6-qualification.yml');
 assert.match(workflow,/workflow_dispatch:/);
 assert.match(workflow,/node-version: 24\.21\.0/);
 assert.match(workflow,/pnpm install --frozen-lockfile/);
 assert.match(workflow,/phase1-3-run-local\.sh --phase3-1/);
 assert.match(workflow,/phase1-3-run-local\.sh --smoke/);
 assert.match(workflow,/HIGH_RISK_FEATURES_RELEASE_QUALIFIED: 'false'/);
 assert.match(workflow,/RELEASE STATUS: NOT APPROVED/);
 assert.doesNotMatch(workflow,/(?:curl|wget)\s+https?:/);
});
