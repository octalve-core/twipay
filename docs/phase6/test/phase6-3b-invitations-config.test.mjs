/** Dependency-free behavioral seams, NOT Nest/Zod/Prisma/PostgreSQL integration qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
const ts=createRequire(import.meta.url)('typescript');
const root=resolve(import.meta.dirname,'../../..');
const read=file=>readFileSync(resolve(root,file),'utf8');
class Denied extends Error{constructor(v){super(v.code);this.code=v.code;}}
const stable=(v)=>JSON.stringify(v);
const fakeZod=()=>{
 const schema={strict(){return this},trim(){return this},min(){return this},max(){return this},regex(){return this},optional(){return this},nullable(){return this},email(){return this},url(){return this},datetime(){return this},parse(value){return value}};
 const z={object:()=>schema,string:()=>schema,email:()=>schema,url:()=>schema,boolean:()=>schema,literal:()=>schema,enum:()=>schema,
  array:()=>schema,iso:{datetime:()=>schema},discriminatedUnion:()=>({parse(v){if(!['BRAND','DEPLOYMENT','FLAG_DISABLE'].includes(v.kind))throw new Error('invalid kind');if(v.kind==='FLAG_DISABLE' && (v.data.enabled!==false || !v.data.key))throw new Error('unsafe flag');return v;}})};
 return {z};
};
const saved=Object.fromEntries(['NODE_ENV','OWNER_GOVERNANCE_SANDBOX_ENABLED','OWNER_CONFIGURATION_SANDBOX_ENABLED','DATA_ENCRYPTION_KEY','PII_FINGERPRINT_KEY'].map(k=>[k,process.env[k]]));
Object.assign(process.env,{NODE_ENV:'test',OWNER_GOVERNANCE_SANDBOX_ENABLED:'true',OWNER_CONFIGURATION_SANDBOX_ENABLED:'true',DATA_ENCRYPTION_KEY:'example-test-key',PII_FINGERPRINT_KEY:'example-fingerprint-key'});
process.on('exit',()=>{for(const[k,v]of Object.entries(saved))v===undefined?delete process.env[k]:process.env[k]=v});
function load(path,name){const code=ts.transpileModule(read(path),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
 const exports={};const crypto=createRequire(import.meta.url)('node:crypto');
 new Function('require','exports','module',code)((id)=>{
  if(id==='node:crypto')return crypto;
  if(id==='zod')return fakeZod();
  if(id==='@nestjs/common')return {ConflictException:Denied,ForbiddenException:Denied,NotFoundException:Denied,ServiceUnavailableException:Denied,Injectable:()=>c=>c};
  if(id==='@twipay/security')return {encryptSensitiveString:x=>`enc:${x}`,decryptSensitiveString:x=>x.slice(4),fingerprintSensitiveValue:x=>crypto.createHash('sha256').update(x).digest('hex')};
  if(id==='./owner-governance.service.js')return {DELEGABLE_STAFF_ROLES:['SUPPORT_AGENT','AUDITOR','COMPLIANCE']};
  if(id==='./transaction-authorization.js')return {assertTransactionalAuthorization:async(_tx,v)=>{if(v.sessionId!=='fresh')throw new Denied({code:'AUTHENTICATION_REQUIRED'})}};
  throw Error('unexpected '+id);
 },exports,{exports});return exports[name];}
const I=load('apps/api/src/modules/operations/application/owner-staff-invitation.service.ts','OwnerStaffInvitationService');
const C=load('apps/api/src/modules/operations/application/owner-configuration-review.service.ts','OwnerConfigurationReviewService');
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',U='cccccccc-cccc-4ccc-8ccc-cccccccccccc',ID='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const email='staff@example.test';
const hash=createRequire(import.meta.url)('node:crypto').createHash('sha256').update(email).digest('hex');
function invitation(overrides={}){
 const s={state:'PREPARED',owner:true,roleAssigned:false,revocations:0,invitationWrites:0,notifications:0,audit:[],registered:true,verified:true,userEmail:email,expiresAt:new Date(Date.now()+86400000),...overrides};
 const record=()=>({id:ID,emailCiphertext:`enc:${email}`,emailFingerprint:hash,emailMasked:'st***@example.test',roleCode:'SUPPORT_AGENT',status:s.state,preparedByUserId:A,checkedByUserId:B,expiresAt:s.expiresAt,reason:'Authorized staff for verified operational needs'});
 const tx={$queryRaw:async()=>[{id:ID}],userRole:{findFirst:async({where})=>where.userId===U?null:(s.owner?{id:ID}:null),findUnique:async()=>s.roleAssigned?{id:ID}:null,create:async()=>{s.roleAssigned=true}},user:{findUnique:async({where})=>where.id===A || where.id===B ? ({id:where.id,email:'owner@example.test',emailVerifiedAt:new Date(),status:'ACTIVE'}) : s.registered?({id:U,email:s.userEmail,emailVerifiedAt:s.verified?new Date():null,status:'ACTIVE'}):null},ownerStaffInvitation:{count:async()=>0,create:async()=>{s.invitationWrites++;return record()},findUnique:async()=>record(),update:async({data})=>{s.state=data.status;s.invitationWrites++;return record()},findMany:async()=>[record()]},role:{findUnique:async()=>({id:ID})},session:{updateMany:async()=>{s.revocations++}}};
 const svc=new I({$transaction:async f=>f(tx),user:{findUnique:tx.user.findUnique},ownerStaffInvitation:{findMany:tx.ownerStaffInvitation.findMany}}, {recordWithTx:async(_tx,x)=>s.audit.push(x)}, {enqueueWithTx:async()=>{s.notifications++}});
 return {s,svc,prepare:()=>svc.prepare({email,roleCode:'SUPPORT_AGENT',reason:'Approved for customer support and operations only',actorUserId:A,sessionId:'fresh'}),decide:(action='APPROVED',who=B)=>svc.decide({invitationId:ID,actorUserId:who,sessionId:'fresh',action,reason:'Security reviewer rejects this invitation based on evidence'}),accept:()=>svc.accept({invitationId:ID,userId:U,sessionId:'fresh'})};
}
test('invitation staging grants nothing; no arbitrary/owner/finance role',async()=>{const h=invitation();await h.prepare();assert.equal(h.s.roleAssigned,false);assert.equal(h.s.notifications,0);await assert.rejects(h.svc.prepare({email,roleCode:'SUPER_ADMIN',reason:'Still no superadmin delegation is permitted',actorUserId:A,sessionId:'fresh'}),{code:'ROLE_NOT_DELEGABLE'});});
test('invitation approval requires different owner, sends notice but no role',async()=>{const h=invitation();await assert.rejects(h.decide('APPROVED',A),{code:'INDEPENDENT_OWNER_CHECKER_REQUIRED'});await h.decide();assert.equal(h.s.notifications,1);assert.equal(h.s.roleAssigned,false);});
test('recipient acceptance requires approved, verified email and recent MFA; revokes sessions',async()=>{const h=invitation();await assert.rejects(h.accept(),{code:'INVITATION_UNAVAILABLE'});h.s.state='APPROVED';const r=await h.accept();assert.equal(r.signInAgain,true);assert.equal(h.s.roleAssigned,true);assert.equal(h.s.revocations,1);await assert.rejects(h.accept(),{code:'INVITATION_UNAVAILABLE'});});
test('unregistered invitation can be staged and checked but cannot grant a role before verified registration and MFA',async()=>{const h=invitation({registered:false});await h.prepare();await h.decide();assert.equal(h.s.roleAssigned,false);h.s.state='APPROVED';await assert.rejects(h.accept(),{code:'INVITATION_ACCOUNT_MISMATCH'});h.s.registered=true;h.s.verified=false;await assert.rejects(h.accept(),{code:'INVITATION_ACCOUNT_MISMATCH'});h.s.verified=true;await h.accept();assert.equal(h.s.roleAssigned,true);});
test('invitation refuses mismatched verified email and expired approved invitation',async()=>{const mismatch=invitation({state:'APPROVED',userEmail:'wrong@example.test'});await assert.rejects(mismatch.accept(),{code:'INVITATION_ACCOUNT_MISMATCH'});assert.equal(mismatch.s.roleAssigned,false);const expired=invitation({state:'APPROVED',expiresAt:new Date(Date.now()-86400000)});await assert.rejects(expired.accept(),{code:'INVITATION_UNAVAILABLE'});});
test('invitation cannot be approved in production and cannot revoke already consumed invitation',async()=>{const h=invitation({state:'ACCEPTED'});await assert.rejects(h.decide('REVOKED'),{code:'INVITATION_STATE_CHANGED'});process.env.NODE_ENV='production';try{await assert.rejects(h.prepare(),{code:'STAFF_INVITATIONS_NOT_RUNTIME_QUALIFIED'})}finally{process.env.NODE_ENV='test'}});
function config(overrides={}){
 const s={state:'PREPARED',role:true,kind:'FLAG_DISABLE',current:{key:'ui.help',enabled:true,public:true,description:'Help'},writes:0,audit:[],...overrides};
 const summary={key:s.current.key,enabled:s.current.enabled,public:s.current.public,description:s.current.description,config:s.current.config ?? null};
 const baselineHash=createRequire(import.meta.url)('node:crypto').createHash('sha256').update(stable(summary)).digest('hex');
 const review=()=>({id:ID,kind:s.kind,targetKey:'ui.help',status:s.state,preparedByUserId:A,reason:'Requested controlled disable and independent review',payload:{key:'ui.help',enabled:false,public:true,description:'Help'},baselineHash,expiresAt:new Date(Date.now()+86400000)});
 const tx={$queryRaw:async()=>[{id:ID}],userRole:{findFirst:async()=>s.role?{id:ID}:null},ownerConfigReview:{count:async()=>0,create:async()=>{s.writes++;return review()},findUnique:async()=>review(),update:async({data})=>{s.state=data.status;s.writes++;return review()}},featureFlag:{findUnique:async()=>s.current,update:async()=>{s.writes++;s.current.enabled=false}},brandConfiguration:{findUnique:async()=>null},deploymentProfile:{findUnique:async()=>null}};
 const svc=new C({$transaction:async f=>f(tx),ownerConfigReview:{findMany:async()=>[review()]}},{recordWithTx:async(_tx,x)=>s.audit.push(x)});
 return {s,svc,prepare:()=>svc.prepare({kind:'FLAG_DISABLE',data:{key:'ui.help',enabled:false,public:true,description:'Help'},reason:'Requested controlled disable and independent review',actorUserId:A,sessionId:'fresh'}),decide:(actor=B)=>svc.decide({reviewId:ID,actorUserId:actor,sessionId:'fresh',decision:'APPROVED'})};
}
test('configuration is staged and no feature flag is enabled through this path',async()=>{const h=config();await h.prepare();assert.equal(h.s.current.enabled,true);assert.equal(h.s.writes,1);await assert.rejects(h.svc.prepare({kind:'FLAG_DISABLE',data:{key:'ui.help',enabled:true,public:true},reason:'No live financial feature may be enabled',actorUserId:A,sessionId:'fresh'}));});
test('checker independence and config drift prevention with zero mutations',async()=>{const h=config();await assert.rejects(h.decide(A),{code:'INDEPENDENT_OWNER_CHECKER_REQUIRED'});assert.equal(h.s.writes,0);h.s.current.enabled=false;await assert.rejects(h.decide(),{code:'CONFIG_CHANGED_SINCE_REVIEW'});assert.equal(h.s.writes,0);});
test('approved reviewed flag disable updates once, with audit; subsequent review cannot replay',async()=>{const h=config();await h.decide();assert.equal(h.s.current.enabled,false);assert.equal(h.s.writes,2);assert.equal(h.s.audit[0].action,'OWNER_CONFIG_APPROVED');await assert.rejects(h.decide(),{code:'CONFIG_REVIEW_NOT_PENDING'});});
test('configuration writes fail closed in production even with opt-in',async()=>{const h=config();process.env.NODE_ENV='production';try{await assert.rejects(h.decide(),{code:'OWNER_CONFIGURATION_NOT_QUALIFIED'})}finally{process.env.NODE_ENV='test'}});
test('schema and SQL constrain role, owner approval, unique pending, read-only auth and immutable evidence',()=>{
 const schema=read('packages/database/prisma/schema.prisma');const sql=read('packages/database/prisma/migrations/0020_owner_invitation_config_governance/migration.sql');const api=read('apps/api/src/modules/operations/presentation/operations.controller.ts');const prod=read('apps/api/src/modules/product/presentation/product.controller.ts');
 for(const key of ['OwnerStaffInvitation','OwnerConfigReview'])assert.match(schema,new RegExp('model '+key));
 assert.match(sql,/one_live_invite_per_email_role/);assert.match(sql,/one_pending_config_change_per_target/);assert.match(sql,/twipay_guard_owner_config_review/);assert.match(sql,/invite_accept_evidence/);
 assert.match(api,/staff\/invitations\/mine/);assert.match(api,/owner\/config\/reviews/);assert.match(api,/ApiBody\(\{ schema: OwnerApiContracts\.configProposal/);
 assert.equal((prod.match(/DIRECT_CONFIGURATION_MUTATION_DISABLED_USE_TWO_OWNER_REVIEW/g)||[]).length,3);
});
