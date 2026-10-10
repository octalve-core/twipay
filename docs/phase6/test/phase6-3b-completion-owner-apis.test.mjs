/** Source-level semantic behavior tests. Real Node24/Nest/PostgreSQL/Swagger remain gated. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const root=resolve(import.meta.dirname,'../../..');
const read=(name)=>readFileSync(resolve(root,name),'utf8');
const ts=createRequire(import.meta.url)('typescript');
function loadClass(file, named){
  const mod={exports:{}};
  const src=read(file);
  const code=ts.transpileModule(src,{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
  class CodedError extends Error{constructor(o){super(o.code);this.code=o.code;}}
  let calls=[];
  new Function('require','module','exports',code)((id)=>{
    if(id==='@nestjs/common')return {Injectable:()=>v=>v,ConflictException:CodedError,NotFoundException:CodedError,ForbiddenException:CodedError,ServiceUnavailableException:CodedError};
    if(id==='./transaction-authorization.js')return {assertTransactionalAuthorization:async(_tx,v)=>{calls.push(v);if(v.sessionId!=='fresh')throw new CodedError({code:'AUTHENTICATION_REQUIRED'});}};
    throw Error('Unexpected runtime dependency: '+id);
  },mod,mod.exports);
  return {Class:mod.exports[named], calls};
}
const ownerPath='apps/api/src/modules/operations/application/owner-governance.service.ts';
const providerPath='apps/api/src/modules/operations/application/provider-operations.service.ts';
const controller=read('apps/api/src/modules/operations/presentation/operations.controller.ts');
const openapi=read('apps/api/src/modules/operations/presentation/owner-openapi.ts');
const ownerUi=read('apps/admin/app/owner/page.tsx');
const customerUi=read('apps/admin/app/owner/customers/page.tsx');
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('owner risk summary aggregates observed provider outcomes, checks, security and audit without secrets',async()=>{
 const {Class}=loadClass(ownerPath,'OwnerGovernanceService');
 const model={
  providerOperation:{groupBy:async()=>[{type:'PAYOUT',status:'UNKNOWN',_count:{_all:3}}]},
  providerCapabilityHealth:{findMany:async()=>[{providerCode:'test',capability:'PAYOUT',circuitState:'OPEN',consecutiveFailures:3,lastFailureAt:null,updatedAt:new Date()}]},
  securityEvent:{groupBy:async()=>[{type:'LOGIN_FAILED',_count:{_all:2}}]},
  eventTicket:{groupBy:async()=>[{status:'ACTIVE',_count:{_all:5}}]},
  ticketCheckIn:{count:async()=>1},event:{count:async()=>2},
  ownerStaffReview:{count:async()=>1},ownerCustomerSuspensionReview:{count:async()=>2},
  operationalAuditEvent:{count:async()=>4},
 };
 const service=new Class(model,{},{});const response=await service.riskOverview();
 assert.deepEqual(response.providerOutcomes,[{type:'PAYOUT',status:'UNKNOWN',count:3}]);
 assert.equal(response.tickets.checkInsInPeriod,1);assert.equal(response.pendingOwnerReviews.staff,1);
 assert.equal(response.ownerAuditActionsInPeriod,4);
 assert.doesNotMatch(JSON.stringify(response),/tokenHash|accountNumberCiphertext|credentialCiphertext|secret|providerReference/);
});
test('customer activity requires real customer and returns only aggregate counts',async()=>{
 const {Class}=loadClass(ownerPath,'OwnerGovernanceService');
 const model={user:{findUnique:async()=>({id:A,status:'ACTIVE'})},
  eventOrder:{groupBy:async()=>[]},securityEvent:{count:async()=>3},
  financialTransaction:{groupBy:async()=>[{type:'TRANSFER',status:'UNKNOWN',_count:{_all:2}}],findMany:async()=>[{id:A,type:'TRANSFER',status:'UNKNOWN',createdAt:new Date()}]},
  supportCase:{groupBy:async()=>[{status:'WAITING_SUPPORT',_count:{_all:1}}],findMany:async()=>[{reference:'sup_'+A,status:'WAITING_SUPPORT',createdAt:new Date()}]}};
 const service=new Class(model,{},{});const d=await service.customerActivity(A);
 assert.equal(d.userId,A);assert.equal(d.transactions[0].count,2);
 assert.equal(d.securityEventCount,3);assert.ok(!('amountMinor' in d.transactions[0]));
 assert.equal(d.recentTransactions[0].id,A);assert.equal(d.recentSupport[0].reference,'sup_'+A);
 assert.ok(!('description' in d.recentTransactions[0]));
 model.user.findUnique=async()=>null;
 await assert.rejects(service.customerActivity(A),{code:'CUSTOMER_NOT_FOUND'});
});
test('owner read routes require owner and declare concrete OpenAPI return/request schemas',()=>{
 for(const route of ["owner/overview","owner/risk","owner/customers","owner/customers/:userId/activity","owner/staff","owner/staff/reviews","owner/customers/suspensions"])
  assert.ok(controller.includes(route),route);
 for(const name of ['riskResponse','activityResponse','customersResponse','staffResponse','reviewsResponse','suspensionsResponse','staffProposal','staffRejection','suspensionProposal','mutationResponse'])
  assert.match(openapi,new RegExp(name+'\\s*:'));
 assert.match(controller,/@ApiBody\(\{ schema: OwnerApiContracts\.staffProposal \}\)/);
 assert.match(controller,/@ApiCookieAuth\(\)/);
 assert.match(controller,/@ApiForbiddenResponse/);
 assert.match(controller,/@RequirePermissions\('ops\.owner\.read'\)/);
 assert.match(ownerUi,/\/operations\/owner\/risk/);assert.match(customerUi,/\/operations\/owner\/customers\/\$\{encodeURIComponent\(id\)\}\/activity/);
});
test('high-risk provider edits remain default off and production denied even when enabled',async()=>{
 const {Class}=loadClass(providerPath,'ProviderOperationsService');
 let changes=0;
 const svc=new Class({$transaction:async()=>{changes++;throw Error('unreachable');}},{});
 const old={node:process.env.NODE_ENV,flag:process.env.PROVIDER_OPERATIONS_SANDBOX_ENABLED};
 try{
  delete process.env.PROVIDER_OPERATIONS_SANDBOX_ENABLED;process.env.NODE_ENV='test';
  await assert.rejects(svc.updateOffer({offerId:A,actorUserId:A,sessionId:'fresh',reason:'test'}),{code:'PROVIDER_OPERATIONS_NOT_QUALIFIED'});
  process.env.PROVIDER_OPERATIONS_SANDBOX_ENABLED='true';process.env.NODE_ENV='production';
  await assert.rejects(svc.resetCircuit({healthId:A,actorUserId:A,sessionId:'fresh',reason:'test'}),{code:'PROVIDER_OPERATIONS_NOT_QUALIFIED'});
  assert.equal(changes,0);
 } finally {for(const[k,v]of [['NODE_ENV',old.node],['PROVIDER_OPERATIONS_SANDBOX_ENABLED',old.flag]])v===undefined?delete process.env[k]:process.env[k]=v;}
});
test('provider mutations verify recent MFA and permissions before any write; lock controlled row',async()=>{
 const {Class,calls}=loadClass(providerPath,'ProviderOperationsService');
 const old={node:process.env.NODE_ENV,flag:process.env.PROVIDER_OPERATIONS_SANDBOX_ENABLED};
 const log=[];
 const before={id:A,providerCode:'test',providerProductCode:'test1',providerBillerCode:'x',productId:A,priority:1,estimatedCostMinor:null,active:true,requiresValidation:false,lastSyncedAt:new Date()};
 const tx={
   $queryRaw:async()=>{log.push('row lock');return[{id:A}];},
   billProviderOffer:{findUnique:async()=>before,update:async()=>{log.push('update');return{...before,priority:2};}},
   providerCapabilityHealth:{findUnique:async()=>null},
 };
 const svc=new Class({$transaction:async(fn,options)=>{assert.equal(options.isolationLevel,'Serializable');return fn(tx)}},
  {recordWithTx:async()=>log.push('audit')});
 try{
  process.env.NODE_ENV='test';process.env.PROVIDER_OPERATIONS_SANDBOX_ENABLED='true';
  await assert.rejects(svc.updateOffer({offerId:A,actorUserId:A,sessionId:'not-fresh',reason:'reviewed',priority:2}),{code:'AUTHENTICATION_REQUIRED'});
  assert.equal(log.length,0);
  const result=await svc.updateOffer({offerId:A,actorUserId:A,sessionId:'fresh',reason:'reviewed',priority:2});
  assert.equal(result.priority,2);assert.deepEqual(log,['row lock','update','audit']);
  assert.equal(calls.at(-1).permission,'ops.providers.manage');assert.equal(calls.at(-1).recentMfa,true);
  assert.match(read(providerPath),/PROVIDER_OPERATIONS_SANDBOX_ENABLED/);
  assert.match(controller,/sessionId:p\.sessionId/);
 }finally{for(const[k,v]of [['NODE_ENV',old.node],['PROVIDER_OPERATIONS_SANDBOX_ENABLED',old.flag]])v===undefined?delete process.env[k]:process.env[k]=v;}
});
test('Phase 6.4 administrator browser verification is explicit, manual and fail closed',()=>{
 const workflow=read('.github/workflows/phase6-4-owner-admin-qualification.yml');
 const spec=read('tests/e2e/administrator/owner-governance.spec.ts');
 const config=read('playwright.admin-qualification.config.ts');
 assert.match(workflow,/workflow_dispatch/);assert.doesNotMatch(workflow,/^\s+push:\s*$/m);
 assert.match(workflow,/environment: qualification/);
 assert.match(workflow,/test -f pnpm-lock\.yaml/);
 assert.match(workflow,/pnpm install --frozen-lockfile/);
 assert.match(workflow,/PROVIDER_OPERATIONS_SANDBOX_ENABLED: 'false'/);
 assert.match(workflow,/HIGH_RISK_FEATURES_RELEASE_QUALIFIED: 'false'/);
 assert.match(workflow,/DISPOSABLE-NO-LIVE-FUNDS/);
 assert.match(spec,/two real owner accounts/);
 assert.match(spec,/selfCheck\.status\(\)\)\.toBe\(403\)/);
 assert.match(spec,/revoked\.status\(\)\)\.toBe\(401\)/);
 assert.match(spec,/expect\(afterStaff\.roles\)\.not\.toContain\('SUPER_ADMIN'\)/);
 assert.match(spec,/throw new Error\('This qualification requires a disposable sandbox/);
 assert.match(config,/forbidOnly: true/);
 assert.doesNotMatch(config,/test\.skip\(/);
});
test('product admin mutations explicitly require MFA, and high-risk flags cannot be activated in production',()=>{
 const p=read('apps/api/src/modules/product/presentation/product.controller.ts');
 for(const path of ["admin/flags","admin/brand","admin/deployment"]){
  const idx=p.indexOf(`@Patch('${path}')`);assert.ok(idx>=0,path);
  const next=p.indexOf('\n  }',idx);assert.match(p.slice(idx,next),/requireMfa\(req\)/);
 }
 assert.match(p,/process\.env\['NODE_ENV'\] === 'production' \|\| process\.env\['HIGH_RISK_FEATURES_RELEASE_QUALIFIED'\]/);
 assert.match(read('apps/api/src/modules/operations/application/provider-operations.service.ts'),/SELECT "id" FROM "bill_products"/);
});
