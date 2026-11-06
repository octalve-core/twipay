/** Actual FinancialAuthorizationService TypeScript execution against an isolated transactional seam.
 * NOT PostgreSQL, provider, MFA enrollment or browser qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = resolve(import.meta.dirname, '../../..');
const rel='apps/api/src/modules/finance/application/financial-authorization.service.ts';
const source=readFileSync(resolve(root,rel),'utf8');
const js=ts.transpileModule(source,{fileName:rel,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
class ApiError extends Error{constructor(payload,status){super(payload.code);this.code=payload.code;this.status=status;}}
function Err(status){return class extends ApiError{constructor(payload){super(payload,status);}};}
const nest={Injectable:()=>klass=>klass,ForbiddenException:Err(403),ServiceUnavailableException:Err(503),HttpException:ApiError,HttpStatus:{TOO_MANY_REQUESTS:429}};
const module={exports:{}};
new Function('require','module','exports',js)((name)=>{
  if(name==='@nestjs/common')return nest;
  if(name==='@twipay/security')return {SESSION_IDLE_TTL_SECONDS:1800};
  if(name==='../../auth/application/transaction-pin.service.js')return {pinMaterial:(user,pin)=>`peppered:${user}:${pin}`};
  throw new Error(`Unexpected import: ${name}`);
},module,module.exports);
const {FinancialAuthorizationService}=module.exports;
const keep={NODE_ENV:process.env.NODE_ENV,FINANCIAL_AUTHORIZATION_SANDBOX_ENABLED:process.env.FINANCIAL_AUTHORIZATION_SANDBOX_ENABLED,MFA_STEP_UP_MAX_AGE_SECONDS:process.env.MFA_STEP_UP_MAX_AGE_SECONDS,SESSION_IDLE_TTL_SECONDS:process.env.SESSION_IDLE_TTL_SECONDS};
process.env.NODE_ENV='test';process.env.FINANCIAL_AUTHORIZATION_SANDBOX_ENABLED='true';
process.on('exit',()=>{for(const [k,v]of Object.entries(keep))if(v===undefined)delete process.env[k];else process.env[k]=v;});
const ago=(ms)=>new Date(Date.now()-ms);
const after=(ms)=>new Date(Date.now()+ms);
const principal={userId:'u1',sessionId:'s1',mfaSatisfied:true,roles:[],permissions:[]};
function harness({pin='2586',limit=100_000n,daily=200_000n,prior=0n,approved=true,verified=true,mfa=true,sessionOwner='u1',locked=false}={}){
  const state={pin,failed:0,lockUntil:locked?after(3600000):null, changedAt:ago(100000), session:{userId:sessionOwner,status:'ACTIVE',expiresAt:after(1000000),lastSeenAt:ago(2000),mfaSatisfiedAt:ago(10000)}, policy:approved?{status:'APPROVED',approvedKycTier:2,approvedAt:ago(200000),maxPerIntentMinor:limit,maxDailyDebitMinor:daily}:null,verified,mfa,events:[],calls:[],prior};
  const tx={
    $queryRaw:async()=>[{id:'u1'}],
    user:{findUnique:async()=>({status:'ACTIVE',emailVerifiedAt:state.verified?ago(30000):null,phoneVerifiedAt:null})},
    session:{findUnique:async()=>state.session},
    mfaCredential:{count:async()=>state.mfa?1:0},
    identityVerification:{count:async()=>state.verified?1:0},
    financialEligibilityPolicy:{findUnique:async()=>state.policy},
    financialTransaction:{aggregate:async()=>({_sum:{amountMinor:state.prior,feeMinor:0n}})},
    transactionPinCredential:{findUnique:async()=>({pinHash:`peppered:u1:${state.pin}`,failedAttempts:state.failed,lockedUntil:state.lockUntil,changedAt:state.changedAt}),update:async({data})=>{state.failed=data.failedAttempts;state.lockUntil=data.lockedUntil;}},
    securityEvent:{create:async({data})=>state.events.push(data)},
  };
  let queue=Promise.resolve();
  const prisma={$transaction:async(fn)=>{const before=queue;let release;queue=new Promise(r=>{release=r;});await before;try{return await fn(tx);}finally{release();}}};
  const service=new FinancialAuthorizationService(prisma,{verify:async(hash,pinMat)=>hash===pinMat});
  const auth=(code='2586',amountMinor=30_000n,intent='TRANSFER')=>service.authorize({principal,transactionPin:code,amountMinor,intent});
  return {state,tx,auth,service};
}
test('default-off and production prohibit authorization without touching database',async()=>{
 const h=harness();process.env.FINANCIAL_AUTHORIZATION_SANDBOX_ENABLED='false';
 try{await assert.rejects(h.auth(),{code:'FINANCIAL_OPERATIONS_NOT_RELEASE_QUALIFIED'});}finally{process.env.FINANCIAL_AUTHORIZATION_SANDBOX_ENABLED='true';}
 process.env.NODE_ENV='production';try{await assert.rejects(h.auth(),{code:'FINANCIAL_OPERATIONS_NOT_RELEASE_QUALIFIED'});}finally{process.env.NODE_ENV='test';}
});
test('unapproved KYC tier and absent policy are default-denied',async()=>{const h=harness({approved:false});await assert.rejects(h.auth(),{code:'FINANCIAL_KYC_TIER_NOT_APPROVED'});});
test('unverified contact, absent verified BVN, or missing MFA block PIN authorization',async()=>{
 const h=harness();h.state.verified=false;await assert.rejects(h.auth(),{code:'CONTACT_VERIFICATION_REQUIRED'});
 h.state.verified=true;h.state.mfa=false;await assert.rejects(h.auth(),{code:'FINANCIAL_MFA_REQUIRED'});
 h.state.mfa=true;h.tx.identityVerification.count=async()=>0;await assert.rejects(h.auth(),{code:'VERIFIED_BVN_REQUIRED'});
});
test('different or expired session, missing MFA step-up and stale session are denied',async()=>{
 const h=harness({sessionOwner:'other'});await assert.rejects(h.auth(),{code:'FINANCIAL_SESSION_EXPIRED'});
 h.state.session.userId='u1';h.state.session.expiresAt=ago(1000);await assert.rejects(h.auth(),{code:'FINANCIAL_SESSION_EXPIRED'});
 h.state.session.expiresAt=after(500000);h.state.session.mfaSatisfiedAt=ago(3600000);await assert.rejects(h.auth(),{code:'FINANCIAL_MFA_REQUIRED'});
});
test('per-intent and cumulative UTC-day limits fail closed',async()=>{
 const h=harness({limit:40000n,daily:50000n,prior:45000n});
 await assert.rejects(h.auth('2586',41000n),{code:'FINANCIAL_TRANSACTION_LIMIT_EXCEEDED'});
 await assert.rejects(h.auth('2586',10000n),{code:'FINANCIAL_DAILY_LIMIT_EXCEEDED'});
});
test('PIN guessing increments persisted lockout and never emits raw secret',async()=>{
 const h=harness();for(let i=0;i<4;i++)await assert.rejects(h.auth('9999'),{code:'PIN_AUTHORIZATION_FAILED'});
 await assert.rejects(h.auth('9999'),{code:'PIN_TEMPORARILY_LOCKED'});
 assert.equal(h.state.failed,5);assert.ok(h.state.lockUntil>new Date());
 await assert.rejects(h.auth('2586'),{code:'PIN_TEMPORARILY_LOCKED'});
 assert.ok(!JSON.stringify(h.state.events).includes('9999'));
});
test('the configured session idle window (default 86400 s, schema maximum 604800 s) does not make authorization unavailable',async()=>{
 const before=process.env.SESSION_IDLE_TTL_SECONDS;
 try{
  process.env.SESSION_IDLE_TTL_SECONDS='86400';assert.equal((await harness().auth()).sessionId,'s1');
  process.env.SESSION_IDLE_TTL_SECONDS='604800';assert.equal((await harness().auth()).sessionId,'s1');
  process.env.SESSION_IDLE_TTL_SECONDS='604801';await assert.rejects(harness().auth(),{code:'FINANCIAL_OPERATIONS_NOT_RELEASE_QUALIFIED'});
 }finally{if(before===undefined)delete process.env.SESSION_IDLE_TTL_SECONDS;else process.env.SESSION_IDLE_TTL_SECONDS=before;}
});
test('correct PIN authorizes a server-only artifact, consumes no client credential, and resets failures',async()=>{
 const h=harness();h.state.failed=3;
 const a=await h.auth();assert.equal(a.sessionId,'s1');assert.equal(a.userId,'u1');assert.equal(a.intent,'TRANSFER');assert.ok(a.pinChangedAt instanceof Date);assert.ok(!('transactionPin' in a));assert.equal(h.state.failed,0);
 await h.service.assertCurrentWithTx(h.tx,a,30000n,{userId:'u1',intent:'TRANSFER'});
});
test('in-transaction recheck rejects PIN reset, MFA/session revocation, limit changes and expiry',async()=>{
 const h=harness();const a=await h.auth();h.state.changedAt=after(1000);
 await assert.rejects(h.service.assertCurrentWithTx(h.tx,a,30000n,{userId:'u1',intent:'TRANSFER'}),{code:'FINANCIAL_AUTHORIZATION_EXPIRED'});
 h.state.changedAt=a.pinChangedAt;h.state.policy.status='SUSPENDED';await assert.rejects(h.service.assertCurrentWithTx(h.tx,a,30000n,{userId:'u1',intent:'TRANSFER'}),{code:'FINANCIAL_KYC_TIER_NOT_APPROVED'});
 h.state.policy.status='APPROVED';h.state.session.status='REVOKED';await assert.rejects(h.service.assertCurrentWithTx(h.tx,a,30000n,{userId:'u1',intent:'TRANSFER'}),{code:'FINANCIAL_SESSION_EXPIRED'});
});
test('serial PIN guessing cannot bypass 5-attempt lockout in mock transaction seam',async()=>{
 const h=harness();await Promise.all(Array.from({length:8},()=>assert.rejects(h.auth('6666'))));
 assert.equal(h.state.failed,5);assert.equal(h.state.events.filter(x=>x.type==='TRANSACTION_PIN_LOCKED').length,1);
});
test('funding and provisioning still require PIN/identity/tier; provisioning uses zero debit',async()=>{
 const h=harness({daily:50000n,prior:50000n});
 const a=await h.auth('2586',0n,'VIRTUAL_ACCOUNT');assert.equal(a.intent,'VIRTUAL_ACCOUNT');
 await h.service.assertCurrentWithTx(h.tx,a,0n,{userId:'u1',intent:'VIRTUAL_ACCOUNT'});
 await assert.rejects(h.auth('2586',500n,'BILL_PAYMENT'),{code:'FINANCIAL_DAILY_LIMIT_EXCEEDED'});
});
test('authorization path has no raw PIN in idempotency request hashes or provider input',()=>{
 const files=['finance/application/transfer.service.ts','finance/application/payment.service.ts','finance/application/virtual-account.service.ts','services/application/bill.service.ts','events/application/event.service.ts'];
 for(const f of files){const src=readFileSync(resolve(root,'apps/api/src/modules',f),'utf8');assert.match(src,/assertCurrentWithTx/);assert.doesNotMatch(src,/request:\s*input\s*[,}]/);}
});

test('authorization cannot cross customer, operation type or amount boundaries',async()=>{
 const h=harness();const a=await h.auth();
 await assert.rejects(h.service.assertCurrentWithTx(h.tx,a,30000n,{userId:'another',intent:'TRANSFER'}),{code:'FINANCIAL_INTENT_BINDING_MISMATCH'});
 await assert.rejects(h.service.assertCurrentWithTx(h.tx,a,30000n,{userId:'u1',intent:'BILL_PAYMENT'}),{code:'FINANCIAL_INTENT_BINDING_MISMATCH'});
 await assert.rejects(h.service.assertCurrentWithTx(h.tx,a,30001n,{userId:'u1',intent:'TRANSFER'}),{code:'FINANCIAL_INTENT_BINDING_MISMATCH'});
});

test('expired PIN lockout resets failure counter instead of violating database check',async()=>{
 const h=harness();h.state.failed=5;h.state.lockUntil=ago(1000);
 await assert.rejects(h.auth('9999'),{code:'PIN_AUTHORIZATION_FAILED'});
 assert.equal(h.state.failed,1);assert.equal(h.state.lockUntil,null);
});
