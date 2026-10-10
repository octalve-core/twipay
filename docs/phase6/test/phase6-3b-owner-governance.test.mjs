/** Source-behavior checks with isolated Prisma/session seams, NOT a real PostgreSQL qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript');
const root=resolve(import.meta.dirname,'../../..');
const source=readFileSync(resolve(root,'apps/api/src/modules/operations/application/owner-governance.service.ts'),'utf8');
const sql=readFileSync(resolve(root,'packages/database/prisma/migrations/0019_owner_governance_independent_staff_access/migration.sql'),'utf8');
const controller=readFileSync(resolve(root,'apps/api/src/modules/operations/presentation/operations.controller.ts'),'utf8');
const schema=readFileSync(resolve(root,'packages/database/prisma/schema.prisma'),'utf8');
const transpiled=ts.transpileModule(source,{fileName:'owner-governance.service.ts',compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
class CodedError extends Error{constructor(payload){super(payload.code);this.code=payload.code}}
let permission='';
const mod={exports:{}};
new Function('require','module','exports',transpiled)(id=>{
 if(id==='@nestjs/common')return {ConflictException:CodedError,ForbiddenException:CodedError,NotFoundException:CodedError,ServiceUnavailableException:CodedError,Injectable:()=>target=>target};
 if(id==='./transaction-authorization.js')return {assertTransactionalAuthorization:async(_tx,input)=>{permission=input.permission;if(input.sessionId!=='recent-mfa')throw new CodedError({code:'AUTHENTICATION_REQUIRED'});}};
 throw Error('Unexpected dependency '+id);
},mod,mod.exports);
const Service=mod.exports.OwnerGovernanceService;
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const target='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const rid='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const prior=Object.fromEntries(['NODE_ENV','OWNER_GOVERNANCE_SANDBOX_ENABLED'].map(k=>[k,process.env[k]]));
Object.assign(process.env,{NODE_ENV:'test',OWNER_GOVERNANCE_SANDBOX_ENABLED:'true'});
process.on('exit',()=>{for(const[k,v]of Object.entries(prior)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
function harness(overrides={}){
 const s={owner:true,targetOwner:false,contact:true,status:'ACTIVE',assigned:false,
   pending:false,reviewStatus:'PREPARED',suspensionStatus:'PREPARED',maker:A,roleCode:'SUPPORT_AGENT',roleAction:'GRANT',createdAt:new Date(),
   writes:[],audit:[],revocations:[],locks:0,...overrides};
 const role={id:rid,code:s.roleCode};
 const record=()=>({id:rid,status:s.reviewStatus,preparedByUserId:s.maker,targetUserId:target,roleCode:s.roleCode,action:s.roleAction,reason:'Manager has verified duties and approved access request',createdAt:s.createdAt});
 const tx={
  $queryRaw:async()=>{s.locks++;return[{id:rid}]},
  userRole:{findFirst:async({where})=>where.userId===target?(s.targetOwner?{roleId:'owner'}:null):(s.owner?{roleId:'owner'}:null),
   findUnique:async()=>s.assigned?{userId:target,roleId:rid}:null,
   create:async v=>{s.writes.push(['grant',v]);s.assigned=true},
   delete:async v=>{s.writes.push(['revoke',v]);s.assigned=false}},
  role:{findUnique:async()=>s.roleCode==='INVALID'?null:role},
  user:{findUnique:async()=>({status:s.status,emailVerifiedAt:s.contact?new Date():null}),
    updateMany:async()=>{if(s.status!=='ACTIVE')return{count:0};s.writes.push(['suspend']);s.status='SUSPENDED';return{count:1}}},
  ownerStaffReview:{count:async()=>s.pending?1:0,
   create:async v=>{s.writes.push(['review',v]);return{id:rid,status:'PREPARED'}},
   findUnique:async()=>record(),
   update:async v=>{s.writes.push(['decision',v]);s.reviewStatus=v.data.status;return{id:rid,status:s.reviewStatus}}},
  ownerCustomerSuspensionReview:{count:async()=>s.pending?1:0,
   create:async v=>{s.writes.push(['suspension-review',v]);return{id:rid,status:'PREPARED'}},
   findUnique:async()=>({id:rid,targetUserId:target,preparedByUserId:s.maker,reason:'Documented evidence of elevated account compromise risk',status:s.suspensionStatus,createdAt:s.createdAt}),
   update:async v=>{s.writes.push(['suspension-decision',v]);s.suspensionStatus=v.data.status;return{id:rid,status:s.suspensionStatus}}},
  session:{updateMany:async v=>s.revocations.push(v)},
 };
 const db={$transaction:async fn=>fn(tx),
   user:{groupBy:async()=>[{status:'ACTIVE',_count:{_all:1}}],findMany:async()=>[{id:target,email:'customer@example.test',status:'ACTIVE',emailVerifiedAt:new Date(),createdAt:new Date(),financialEligibility:null}]},
   supportCase:{count:async()=>2},userRole:{count:async()=>1,findMany:async()=>[]},
   ownerStaffReview:{findMany:async()=>[record()]}};
 const svc=new Service(db,{recordWithTx:async(_tx,v)=>s.audit.push(v)}, {dashboard:async()=>({users:1,period:{from:new Date(),to:new Date()},transactions:[],queues:{openDisputes:0,openReconciliation:0,pendingOrganizerPayouts:0}})});
 const prepare=(change={})=>svc.prepare({targetUserId:target,roleCode:'SUPPORT_AGENT',action:'GRANT',actorUserId:A,sessionId:'recent-mfa',reason:'Verified support staff onboarding with owner review',...change});
 const decide=(change={})=>svc.decide({reviewId:rid,actorUserId:B,sessionId:'recent-mfa',decision:'APPROVED',...change});
 return {s,svc,prepare,decide};
}
test('all staff changes default off and cannot be run in production',async()=>{
 const h=harness();process.env.OWNER_GOVERNANCE_SANDBOX_ENABLED='false';try{await assert.rejects(h.prepare(),{code:'OWNER_GOVERNANCE_CHANGE_NOT_QUALIFIED'});}finally{process.env.OWNER_GOVERNANCE_SANDBOX_ENABLED='true';}
 process.env.NODE_ENV='production';try{await assert.rejects(h.decide(),{code:'OWNER_GOVERNANCE_CHANGE_NOT_QUALIFIED'});}finally{process.env.NODE_ENV='test';}
 assert.equal(h.s.writes.length,0);
});
test('cannot delegate owner, finance, provider-admin or arbitrary roles',async()=>{
 const h=harness();for(const roleCode of ['SUPER_ADMIN','FINANCE_APPROVER','OPERATIONS','ADMIN','ops.providers.manage'])await assert.rejects(h.prepare({roleCode}),{code:'ROLE_NOT_DELEGABLE'});
 assert.equal(h.s.writes.length,0);
});
test('maker must have owner role and recent session assurance',async()=>{
 const denied=harness({owner:false});await assert.rejects(denied.prepare(),{code:'OWNER_REQUIRED'});
 const step=harness();await assert.rejects(step.prepare({sessionId:'old-session'}),{code:'AUTHENTICATION_REQUIRED'});
 assert.equal(denied.s.writes.length+step.s.writes.length,0);
});
test('owner may not grant themself a role or manage another owner',async()=>{
 const h=harness();await assert.rejects(h.prepare({targetUserId:A}),{code:'SELF_ROLE_CHANGE_DENIED'});
 const t=harness({targetOwner:true});await assert.rejects(t.prepare(),{code:'OWNER_ROLE_TARGET_RESTRICTED'});
});
test('stage only currently unassigned, active, verified staff; no direct role writes',async()=>{
 for(const cfg of [{assigned:true},{status:'SUSPENDED'},{contact:false},{pending:true}]){
  const h=harness(cfg);await assert.rejects(h.prepare());assert.equal(h.s.writes.length,0);
 }
 const h=harness();assert.deepEqual(await h.prepare(),{id:rid,status:'PREPARED'});assert.equal(permission,'ops.owner.staff.prepare');
 assert.equal(h.s.writes.length,1);assert.equal(h.s.writes[0][0],'review');assert.equal(h.s.audit[0].action,'OWNER_STAFF_CHANGE_PREPARED');
});
test('checker independent of maker and target, and only actual current owner may check',async()=>{
 const maker=harness();await assert.rejects(maker.decide({actorUserId:A}),{code:'INDEPENDENT_OWNER_CHECKER_REQUIRED'});assert.equal(maker.s.writes.length,0);
 const self=harness();await assert.rejects(self.decide({actorUserId:target}),{code:'OWNER_REQUIRED'});assert.equal(self.s.writes.length,0);
 const nonowner=harness({owner:false});await assert.rejects(nonowner.decide(),{code:'OWNER_REQUIRED'});
});
test('two owner approvals grant an approved role and revoke every stale target session',async()=>{
 const h=harness();const out=await h.decide();assert.deepEqual(out,{id:rid,status:'APPROVED'});
 assert.equal(permission,'ops.owner.staff.approve');assert.equal(h.s.writes[0][0],'grant');assert.equal(h.s.writes[1][0],'decision');
 assert.equal(h.s.revocations.length,1);assert.equal(h.s.revocations[0].data.status,'REVOKED');
 assert.equal(h.s.audit[0].action,'OWNER_STAFF_CHANGE_APPROVED');
});
test('revocation requires existing assignment and revokes sessions on approval',async()=>{
 const h=harness({assigned:true,roleAction:'REVOKE'});await h.decide();assert.equal(h.s.writes[0][0],'revoke');assert.equal(h.s.revocations.length,1);
 const missing=harness({assigned:false,roleAction:'REVOKE'});await assert.rejects(missing.decide(),{code:'STAFF_ROLE_STATE_CHANGED'});assert.equal(missing.s.writes.length,0);
});
test('rejection leaves assignments and sessions unchanged but records independently checked evidence',async()=>{
 const h=harness();await h.decide({decision:'REJECTED',reason:'No independently verified staffing need'});
 assert.deepEqual(h.s.writes.map(x=>x[0]),['decision']);assert.equal(h.s.revocations.length,0);
 assert.equal(h.s.audit[0].action,'OWNER_STAFF_CHANGE_REJECTED');
});
test('a stale or duplicate review cannot make multiple role or session changes',async()=>{
 const h=harness({reviewStatus:'APPROVED'});await assert.rejects(h.decide(),{code:'STAFF_REVIEW_ALREADY_DECIDED'});assert.equal(h.s.writes.length,0);
 const changed=harness({assigned:true});await assert.rejects(changed.decide(),{code:'STAFF_ROLE_STATE_CHANGED'});assert.equal(changed.s.writes.length,0);
});
test('customer directory never returns raw email, wallet balance, BVN or NIN',async()=>{
 const h=harness();const data=await h.svc.customers({});assert.equal(data.customers[0].emailMasked,'cu***@example.test');
 assert.ok(!('email' in data.customers[0]));assert.ok(!('wallets' in data.customers[0]));
 await assert.rejects(h.svc.customers({search:'John'}),{code:'CUSTOMER_SEARCH_MUST_BE_EXACT'});
});
test('schema/SQL/API enforce two-party review and prohibit owner bootstrap via API',()=>{
 assert.match(schema,/model OwnerStaffReview/);assert.match(sql,/owner_staff_checker_independent/);
 assert.match(sql,/one_pending_staff_change_per_role/);assert.match(sql,/owner_staff_review_immutable/);
 assert.match(sql,/SUPPORT_AGENT/);assert.doesNotMatch(sql,/INSERT INTO "user_roles"/i);
 assert.match(controller,/requireOwner\(req\)/);assert.match(controller,/@RequirePermissions\('ops\.owner\.staff\.approve'\)/);
 assert.doesNotMatch(source,/journalEntry\.create|wallet\.update|financialEligibilityPolicy\.update|activateProvider/);
 assert.match(source,/isolationLevel: 'Serializable'/);
});

test('customer suspension must be independently prepared; owner and stale customer states denied',async()=>{
 const maker=harness();const prep=await maker.svc.prepareSuspension({targetUserId:target,actorUserId:A,sessionId:'recent-mfa',reason:'Documented evidence of elevated account compromise risk'});
 assert.equal(prep.status,'PREPARED');assert.equal(maker.s.writes[0][0],'suspension-review');assert.equal(maker.s.revocations.length,0);
 for(const cfg of [{targetOwner:true},{status:'SUSPENDED'},{pending:true}]){
  const h=harness(cfg);await assert.rejects(h.svc.prepareSuspension({targetUserId:target,actorUserId:A,sessionId:'recent-mfa',reason:'Documented account access compromise evidence'}));assert.equal(h.s.writes.length,0);
 }
});
test('independent owner suspension revokes customer sessions without touching finance',async()=>{
 const h=harness();const out=await h.svc.decideSuspension({reviewId:rid,actorUserId:B,sessionId:'recent-mfa',decision:'APPROVED'});
 assert.equal(out.status,'APPROVED');assert.equal(h.s.status,'SUSPENDED');assert.equal(h.s.revocations.length,1);
 assert.equal(h.s.audit[0].action,'OWNER_CUSTOMER_SUSPENSION_APPROVED');
 assert.deepEqual(h.s.writes.map(x=>x[0]),['suspend','suspension-decision']);
});
test('suspension reviewer cannot be its maker or target; stale review cannot change status',async()=>{
 const h=harness();await assert.rejects(h.svc.decideSuspension({reviewId:rid,actorUserId:A,sessionId:'recent-mfa',decision:'APPROVED'}),{code:'INDEPENDENT_OWNER_CHECKER_REQUIRED'});
 const stale=harness({suspensionStatus:'APPROVED'});await assert.rejects(stale.svc.decideSuspension({reviewId:rid,actorUserId:B,sessionId:'recent-mfa',decision:'APPROVED'}),{code:'SUSPENSION_REVIEW_ALREADY_DECIDED'});
 assert.equal(h.s.writes.length,0);assert.equal(stale.s.writes.length,0);
});
test('rejected suspension changes no customer status or session and records evidence',async()=>{
 const h=harness();await h.svc.decideSuspension({reviewId:rid,actorUserId:B,sessionId:'recent-mfa',decision:'REJECTED',reason:'Investigated and found no corroborating evidence'});
 assert.equal(h.s.status,'ACTIVE');assert.equal(h.s.revocations.length,0);assert.equal(h.s.audit[0].action,'OWNER_CUSTOMER_SUSPENSION_REJECTED');
 assert.match(sql,/owner_suspension_checker_independent/);assert.match(sql,/one_pending_suspension_per_customer/);
 assert.match(source,/status: 'SUSPENDED'/);assert.doesNotMatch(source,/status: 'ACTIVE'.*reinstat/);
});

test('old staff and customer suspension proposals cannot be checked into effect',async()=>{
 const past=new Date(Date.now()-8*86400_000);
 const a=harness({createdAt:past});await assert.rejects(a.decide(),{code:'STAFF_REVIEW_EXPIRED'});assert.equal(a.s.writes.length,0);
 const b=harness({createdAt:past});await assert.rejects(b.svc.decideSuspension({reviewId:rid,actorUserId:B,sessionId:'recent-mfa',decision:'APPROVED'}),{code:'SUSPENSION_REVIEW_EXPIRED'});
 assert.equal(b.s.writes.length,0);
});

test('expired review can be rejected to free a pending-slot without granting access',async()=>{
 const h=harness({createdAt:new Date(Date.now()-9*86400_000)});
 await h.decide({decision:'REJECTED',reason:'Evidence stale; restart independent staff access evaluation'});
 assert.deepEqual(h.s.writes.map(x=>x[0]),['decision']);assert.equal(h.s.revocations.length,0);
 const c=harness({createdAt:new Date(Date.now()-9*86400_000)});
 await c.svc.decideSuspension({reviewId:rid,actorUserId:B,sessionId:'recent-mfa',decision:'REJECTED',reason:'Evidence stale; reassess customer before any restriction'});
 assert.deepEqual(c.s.writes.map(x=>x[0]),['suspension-decision']);assert.equal(c.s.status,'ACTIVE');
});
