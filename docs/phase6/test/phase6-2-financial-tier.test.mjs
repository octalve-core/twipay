/** Phase 6.2 policy tests execute the actual TypeScript service with isolated transactional seams.
 * They do NOT claim PostgreSQL migrations, Node 24 builds, or runtime financial qualification.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const root=resolve(import.meta.dirname,'../../..');
const path='apps/api/src/modules/operations/application/financial-tier-review.service.ts';
const src=readFileSync(resolve(root,path),'utf8');
const compiled=ts.transpileModule(src,{fileName:path,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
class ErrorWithCode extends Error{constructor(payload){super(payload.code);this.code=payload.code;}}
const mod={exports:{}};let lastPermission='';
new Function('require','module','exports',compiled)((id)=>{
  if(id==='@nestjs/common')return {ConflictException:ErrorWithCode,ForbiddenException:ErrorWithCode,NotFoundException:ErrorWithCode,ServiceUnavailableException:ErrorWithCode,Injectable:()=>v=>v};
  if(id==='./transaction-authorization.js')return {assertTransactionalAuthorization:async(_tx,arg)=>{lastPermission=arg.permission;if(arg.sessionId!=='step-up')throw new ErrorWithCode({code:'AUTHENTICATION_REQUIRED'});}};
  throw Error('Unexpected dependency: '+id);
},mod,mod.exports);
const Service=mod.exports.FinancialTierReviewService;
const customer='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const maker='bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const checker='cccccccc-cccc-4ccc-cccc-cccccccccccc';
const reviewId='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const bvnId='ffffffff-ffff-4fff-8fff-ffffffffffff';
const proposed={id:reviewId,userId:customer,status:'PREPARED',proposedTier:2,maxPerIntentMinor:2000n,maxDailyDebitMinor:4000n,evidenceReference:bvnId,note:'Identity and risk evidence reviewed independently before recommendation',preparedByUserId:maker};
const keep=Object.fromEntries(['NODE_ENV','FINANCIAL_TIER_REVIEW_SANDBOX_ENABLED','FINANCIAL_TIER_MAX_PER_INTENT_MINOR','FINANCIAL_TIER_MAX_DAILY_DEBIT_MINOR'].map(k=>[k,process.env[k]]));
Object.assign(process.env,{NODE_ENV:'test',FINANCIAL_TIER_REVIEW_SANDBOX_ENABLED:'true',FINANCIAL_TIER_MAX_PER_INTENT_MINOR:'5000',FINANCIAL_TIER_MAX_DAILY_DEBIT_MINOR:'10000'});
process.on('exit',()=>{for(const [key,v] of Object.entries(keep)){if(v===undefined)delete process.env[key];else process.env[key]=v;}});
function harness({record=proposed,contact=true,bvn=1,mfa=1,userStatus='ACTIVE',policy=null}={}) {
 const state={record,contact,bvn,mfa,userStatus,policy,writes:[],audits:[],locks:0,created:[],evidenceOwner:customer,expiresAt:null};
 const tx={
   $queryRaw:async()=>{state.locks++},
   user:{findUnique:async()=>({status:state.userStatus,emailVerifiedAt:state.contact?new Date():null,phoneVerifiedAt:null})},
   mfaCredential:{count:async()=>state.mfa},
   identityVerification:{findUnique:async()=>state.bvn?{userId:state.evidenceOwner,type:'BVN',status:'VERIFIED',expiresAt:state.expiresAt}:null},
   financialEligibilityPolicy:{findUnique:async()=>state.policy,upsert:async input=>{state.writes.push(input);state.policy=input.create;return input.create}},
   financialTierReview:{
     count:async()=>state.record?.status==='PREPARED'?1:0,
     create:async input=>{state.created.push(input);return {...input.data,id:reviewId,status:'PREPARED'}},
     findUnique:async()=>state.record,
     update:async input=>{state.writes.push(input);state.record={...state.record,...input.data};return state.record},
   },
 };
 const prisma={$transaction:async fn=>fn(tx),financialTierReview:{findMany:async()=>record?[record]:[]}};
 const s=new Service(prisma,{recordWithTx:async(_tx,input)=>state.audits.push(input)});
 const approve=(actorUserId=checker)=>s.approve({reviewId,actorUserId,sessionId:'step-up'});
 const prepare=(overrides={})=>s.prepare({userId:customer,actorUserId:maker,sessionId:'step-up',tier:2,maxPerIntentMinor:2000n,maxDailyDebitMinor:4000n,evidenceReference:bvnId,note:'Identity and risk evidence reviewed independently before recommendation',...overrides});
 return {s,state,approve,prepare};
}
test('review endpoints fail closed by default and always in production',async()=>{
 const h=harness();process.env.FINANCIAL_TIER_REVIEW_SANDBOX_ENABLED='false';
 try{await assert.rejects(h.approve(),{code:'FINANCIAL_TIER_REVIEW_NOT_QUALIFIED'});}finally{process.env.FINANCIAL_TIER_REVIEW_SANDBOX_ENABLED='true';}
 process.env.NODE_ENV='production';try{await assert.rejects(h.approve(),{code:'FINANCIAL_TIER_REVIEW_NOT_QUALIFIED'});}finally{process.env.NODE_ENV='test';}
 assert.equal(h.state.writes.length,0);
});
test('maker records review evidence without changing eligibility policy',async()=>{
 const h=harness({record:null});const out=await h.prepare();
 assert.equal(out.status,'PREPARED');assert.equal(h.state.writes.length,0);
 assert.equal(h.state.created.length,1);assert.equal(lastPermission,'ops.tiers.prepare');
 assert.equal(h.state.audits[0].action,'FINANCIAL_TIER_REVIEW_PREPARED');
});
test('maker cannot self approve or create duplicate pending review',async()=>{
 const h=harness();await assert.rejects(h.prepare({actorUserId:customer}),{code:'SELF_APPROVAL_FORBIDDEN'});
 await assert.rejects(h.prepare(),{code:'FINANCIAL_TIER_REVIEW_ALREADY_PENDING'});
 assert.equal(h.state.writes.length,0);
});
test('independent checker with verified identity, contact and MFA may stage approved tier without provider activation',async()=>{
 const h=harness();const out=await h.approve();assert.equal(out.status,'APPROVED');
 assert.equal(h.state.policy.status,'APPROVED');assert.equal(h.state.policy.approvedKycTier,2);
 assert.equal(lastPermission,'ops.tiers.approve');assert.equal(h.state.audits[0].action,'FINANCIAL_TIER_REVIEW_APPROVED');
 assert.equal(h.state.locks,2);assert.doesNotMatch(src,/activateProvider|enableFinancialFlags|captureHold|journalEntry\.create/);
});
test('maker cannot check same proposal and checker cannot self approve',async()=>{
 for(const who of [maker,customer]){const h=harness();await assert.rejects(h.approve(who),{code:'MAKER_CHECKER_SEPARATION_REQUIRED'});assert.equal(h.state.writes.length,0)}
});
test('contact, current BVN, MFA and active customer are independently required at approval',async()=>{
 for(const input of [{contact:false},{bvn:0},{mfa:0},{userStatus:'SUSPENDED'}]){
  const h=harness(input);await assert.rejects(h.approve(),{code:'INDEPENDENT_KYC_CONTACT_MFA_EVIDENCE_REQUIRED'});assert.equal(h.state.writes.length,0);
 }
});
test('customer-bound BVN evidence must remain current during both preparation and approval',async()=>{
 const h=harness({record:null});h.state.evidenceOwner=maker;
 await assert.rejects(h.prepare(),{code:'VERIFIED_BVN_EVIDENCE_REQUIRED'});
 const r=harness();r.state.expiresAt=new Date(Date.now()-1000);
 await assert.rejects(r.approve(),{code:'INDEPENDENT_KYC_CONTACT_MFA_EVIDENCE_REQUIRED'});
 assert.equal(r.state.writes.length,0);
});
test('suspended policy and changed or missing caps deny without writes',async()=>{
 const h=harness({policy:{status:'SUSPENDED'}});await assert.rejects(h.approve(),{code:'SUSPENDED_TIER_REQUIRES_SEPARATE_REINSTATEMENT'});
 const b=harness();process.env.FINANCIAL_TIER_MAX_DAILY_DEBIT_MINOR='1000';try{await assert.rejects(b.approve(),{code:'FINANCIAL_TIER_LIMITS_NOT_APPROVED'});}finally{process.env.FINANCIAL_TIER_MAX_DAILY_DEBIT_MINOR='10000';}
 assert.equal(h.state.writes.length,0);assert.equal(b.state.writes.length,0);
});
test('rejections are independent, audited, and leave finance eligibility untouched',async()=>{
 const h=harness();const out=await h.s.reject({reviewId,actorUserId:checker,sessionId:'step-up',reason:'Risk evidence insufficient'});
 assert.equal(out.status,'REJECTED');assert.equal(h.state.writes.length,1);assert.equal(h.state.policy,null);
 assert.equal(h.state.audits[0].action,'FINANCIAL_TIER_REVIEW_REJECTED');
});
test('migration and HTTP contracts enforce role separation, immutable evidence and default-off release',()=>{
 const sql=readFileSync(resolve(root,'packages/database/prisma/migrations/0018_financial_tier_independent_approval/migration.sql'),'utf8');
 const ctrl=readFileSync(resolve(root,'apps/api/src/modules/operations/presentation/operations.controller.ts'),'utf8');
 assert.match(sql,/only_one_prepared_tier_review_per_user/);assert.match(sql,/financial_tier_reviews_immutable/);
 assert.match(sql,/tier_review_checker_separation/);assert.match(sql,/financial_policy_requires_independent_review/);assert.match(sql,/ops\.tiers\.approve/);
 assert.match(ctrl,/@RequirePermissions\('ops\.tiers\.prepare'\)/);assert.match(ctrl,/@RequirePermissions\('ops\.tiers\.approve'\)/);
 assert.match(src,/isolationLevel: 'Serializable'/);assert.match(src,/NODE_ENV.*production/);
});
