/** Phase 4.6 executable policy tests against transpiled service, isolated DB seams only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const root=resolve(import.meta.dirname,'../../..');
const read=path=>readFileSync(resolve(root,path),'utf8');
class ApiError extends Error {constructor(payload){super(payload.code);this.code=payload.code;}}
const serviceFile='apps/api/src/modules/operations/application/financial-exception.service.ts';
const compiled=ts.transpileModule(read(serviceFile),{fileName:serviceFile,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
const module={exports:{}};
const auth=[];
new Function('require','module','exports',compiled)((id)=>{
  if(id==='@nestjs/common')return {ConflictException:ApiError,NotFoundException:ApiError,Injectable:()=>c=>c};
  if(id==='./transaction-authorization.js')return {assertTransactionalAuthorization:async(_tx,input)=>{auth.push(input);if(input.sessionId!=='active-session')throw new ApiError({code:'AUTHENTICATION_REQUIRED'})}};
  throw Error('Unexpected runtime import: '+id);
},module,module.exports);
const Service=module.exports.FinancialExceptionService;
const caseId='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const maker='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const checker='cccccccc-cccc-4ccc-cccc-cccccccccccc';
const base={id:caseId,financialTransactionId:'f-id',providerOperationId:'op-id',type:'PROVIDER_STATUS_MISMATCH',status:'NEEDS_REVIEW',reviewPreparedByUserId:maker,reviewPreparedAt:new Date(),reviewNote:'Verified matching provider and bank records',
  financialTransaction:{id:'f-id',reference:'twipay:test',type:'TRANSFER',status:'SUCCEEDED',currency:'NGN',amountMinor:3000n,feeMinor:0n,holds:[]},
  providerOperation:{id:'op-id',financialTransactionId:'f-id',type:'PAYOUT',status:'SUCCEEDED',providerCode:'paystack'}};
const actor=(id=checker)=>({caseId,actorUserId:id,sessionId:'active-session',requestId:'test'});
function harness(record=base,{posted=1}={}){
  const writes=[];let locks=0;
  const tx={$queryRaw:async()=>{locks++},reconciliationCase:{findUnique:async()=>record,update:async arg=>{writes.push(arg);return {...record,...arg.data}}},journalTransaction:{count:async()=>posted}};
  const db={$transaction:async fn=>fn(tx),reconciliationCase:{findMany:async()=>[record]},walletHold:{findMany:async()=>[]}};
  const audits=[];const s=new Service(db,{recordWithTx:async(_tx,input)=>{audits.push(input)}});
  return {s,writes,audits,get locks(){return locks}};
}
test('queue includes only masked operational evidence; never returns raw provider references or input evidence',async()=>{
  const h=harness({...base,evidence:{accountNumber:'0123456789'},providerOperation:{...base.providerOperation,providerReference:'top-secret'}});
  const out=await h.s.queue();assert.equal(out.cases.length,1);assert.equal(out.bounded,true);
  assert.equal(out.cases[0].financial.amountMinor,'3000');
  assert.equal(JSON.stringify(out).includes('0123456789'),false);
  assert.equal(JSON.stringify(out).includes('top-secret'),false);
});
test('an independent checker may document matched terminal status with posted journal and zero active holds',async()=>{
  const h=harness();const out=await h.s.closeVerifiedStatusCase(actor());
  assert.deepEqual(out,{id:caseId,status:'RESOLVED',noMoneyMovementPerformed:true});
  assert.equal(h.writes.length,1);assert.equal(h.writes[0].data.status,'RESOLVED');
  assert.equal(h.writes[0].data.resolution.noMoneyMovementPerformed,true);
  assert.equal(h.audits[0].action,'FINANCIAL_EXCEPTION_STATUS_REVIEW_CLOSED');
  assert.equal(h.locks,3);
  assert.equal(auth.at(-1).permission,'ops.reconciliation.approve');
  assert.equal(auth.at(-1).recentMfa,true);
});
test('same maker/checker, absent preparation or invalid session fail closed',async()=>{
  for(const record of [base,{...base,reviewPreparedByUserId:null},{...base,reviewNote:null},{...base,reviewPreparedAt:null}]){
    const h=harness(record);const a=record===base?actor(maker):actor();
    await assert.rejects(h.s.closeVerifiedStatusCase(a),{code:'INDEPENDENT_RECONCILIATION_REVIEW_REQUIRED'});
    assert.equal(h.writes.length,0);
  }
  const h=harness();await assert.rejects(h.s.closeVerifiedStatusCase({...actor(),sessionId:'revoked'}),{code:'AUTHENTICATION_REQUIRED'});
  assert.equal(h.writes.length,0);
});
test('unresolved provider mismatches, missing links and active holds cannot close',async()=>{
  for(const changes of [
    {type:'AMOUNT_MISMATCH'}, {providerOperation:null}, {financialTransaction:null},
    {providerOperation:{...base.providerOperation,financialTransactionId:'other'}},
    {providerOperation:{...base.providerOperation,status:'UNKNOWN'}},
    {providerOperation:{...base.providerOperation,status:'FAILED'}},
    {financialTransaction:{...base.financialTransaction,status:'UNKNOWN'}},
    {financialTransaction:{...base.financialTransaction,holds:[{status:'ACTIVE'}]}},
  ]){
    const h=harness({...base,...changes});
    await assert.rejects(h.s.closeVerifiedStatusCase(actor()),{code:'RECONCILIATION_UNRESOLVED_FINANCIAL_EVIDENCE'});
    assert.equal(h.writes.length,0);
  }
});
test('successful or reversed settlement without a posted journal cannot be closed',async()=>{
  const h=harness(base,{posted:0});
  await assert.rejects(h.s.closeVerifiedStatusCase(actor()),{code:'RECONCILIATION_POSTED_LEDGER_EVIDENCE_REQUIRED'});
  assert.equal(h.writes.length,0);
});
test('terminal matched verified failure can be documented without fake success journal',async()=>{
  const failed={...base,providerOperation:{...base.providerOperation,status:'FAILED'},financialTransaction:{...base.financialTransaction,status:'FAILED'}};
  const h=harness(failed,{posted:0});
  const result=await h.s.closeVerifiedStatusCase(actor());assert.equal(result.status,'RESOLVED');
});
test('maker preparation is serialized, MFA-protected, audited, and cannot be repeated',async()=>{
  const fresh={...base,status:'OPEN',reviewPreparedByUserId:null,reviewPreparedAt:null,reviewNote:null};
  const h=harness(fresh);const out=await h.s.prepare({...actor(maker),note:'Documented initial review, pending provider follow-up'});
  assert.equal(out.status,'NEEDS_REVIEW');assert.equal(h.writes[0].data.reviewPreparedByUserId,maker);
  assert.equal(h.audits[0].action,'FINANCIAL_EXCEPTION_REVIEW_PREPARED');
  assert.equal(auth.at(-1).permission,'ops.reconciliation.prepare');
  const already=harness(base);await assert.rejects(already.s.prepare({...actor(maker),note:'Do not overwrite previous reviewer evidence'}),{code:'RECONCILIATION_ALREADY_PREPARED_OR_CLOSED'});
});
test('schema and migration enforce distinct roles without granting financial execution',()=>{
  const schema=read('packages/database/prisma/schema.prisma');
  const sql=read('packages/database/prisma/migrations/0015_financial_exception_review/migration.sql');
  const ctl=read('apps/api/src/modules/operations/presentation/operations.controller.ts');
  const service=read(serviceFile);
  assert.match(schema,/reviewPreparedByUserId\s+String\?/);
  assert.match(sql,/reconciliation_independent_reviewers/);
  assert.match(sql,/reconciliation_independent_close/);
  assert.match(sql,/ops\.reconciliation\.approve/);
  assert.match(ctl,/@RequirePermissions\('ops\.reconciliation\.read'\)/);
  assert.match(ctl,/@RequirePermissions\('ops\.reconciliation\.prepare'\)/);
  assert.match(ctl,/@RequirePermissions\('ops\.reconciliation\.approve'\)/);
  assert.doesNotMatch(service,/captureHoldWithTx|releaseHoldWithTx|journalEntry\.create|provider\.createPayout|wallet\.update/);
});
