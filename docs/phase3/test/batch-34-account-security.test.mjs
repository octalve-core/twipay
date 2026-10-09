/** Executes Phase 3.4 TypeScript services with in-memory transactional seams.
 * These tests do not claim a PostgreSQL or real Argon2/provider qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const root=resolve(import.meta.dirname,'../../..');
const pepper='only-unit-test-independent-pin-pepper-over-thirty-two';
const original={SESSION_HASH_PEPPER:process.env.SESSION_HASH_PEPPER,TRANSACTION_PIN_PEPPER:process.env.TRANSACTION_PIN_PEPPER};
process.env.SESSION_HASH_PEPPER='only-unit-test-session-pepper-over-thirty-two';
process.env.TRANSACTION_PIN_PEPPER=pepper;
process.on('exit',()=>{for(const [k,v] of Object.entries(original))if(v===undefined)delete process.env[k];else process.env[k]=v;});

class HttpError extends Error{constructor(value,status){super(value?.code??'ERROR');this.status=status;}}
function Err(status){return class extends HttpError{constructor(data){super(data,status);}};}
const nest={Injectable:()=>c=>c,ConflictException:Err(409),ForbiddenException:Err(403),HttpException:class extends HttpError{},HttpStatus:{TOO_MANY_REQUESTS:429}};
function moduleFrom(rel){
  const filename=resolve(root,rel);
  const source=readFileSync(filename,'utf8');
  const js=ts.transpileModule(source,{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;
  const module={exports:{}};
  new Function('require','module','exports',js)((name)=>{
    if(name.startsWith('node:'))return require(name);
    if(name==='@nestjs/common')return nest;
    if(name==='@twipay/security')return{validatePasswordPolicy:pass=>pass.length>=12?[]:['PASSWORD_TOO_SHORT']};
    if(name==='./credential-challenge.js')return challenge;
    throw Error(`Unexpected runtime import ${name} in ${rel}`);
  },module,module.exports);
  return module.exports;
}
const challenge=moduleFrom('apps/api/src/modules/auth/application/credential-challenge.ts');
const {TransactionPinService}=moduleFrom('apps/api/src/modules/auth/application/transaction-pin.service.ts');
const {PasswordEnrollmentService}=moduleFrom('apps/api/src/modules/auth/application/password-enrollment.service.ts');
function harness({google=true,hasPassword=true,verified=true}={}){
  const account={id:'u1',email:'person@example.com',emailVerifiedAt:verified?new Date():null,status:'ACTIVE'};
  const state={account,credential:hasPassword?{userId:'u1',passwordHash:'hash:correct-password'}:null,google, pin:null,pinChallenges:[],enrollChallenges:[],notices:[],events:[],sessions:[{id:'s1',status:'ACTIVE'},{id:'s2',status:'ACTIVE'}]};
  let queue=Promise.resolve();
  const now=()=>new Date();
  const challengeModel=(items)=>({
    findFirst:async({where})=>items.filter(c=>c.userId===where.userId).sort((a,b)=>b.createdAt-a.createdAt)[0]??null,
    count:async({where})=>items.filter(c=>c.userId===where.userId&&c.createdAt>=where.createdAt.gte).length,
    create:async({data})=>{const c={id:`challenge-${items.length+1}`,createdAt:now(),failedAttempts:0,consumedAt:null,...data};items.push(c);return c;},
    update:async({where,data})=>{const c=items.find(x=>x.id===where.id);if(!c)throw Error('challenge not found'); if(data.failedAttempts)c.failedAttempts+=data.failedAttempts.increment;return c;},
    updateMany:async({where,data})=>{let count=0;for(const c of items){if(c.userId===where.userId && (!where.consumedAt || c.consumedAt===null)){c.consumedAt=data.consumedAt;count++;}}return{count};},
  });
  const tx={
    $queryRaw:async()=>[{id:'u1'}],
    user:{findUniqueOrThrow:async()=>account},
    passwordCredential:{findUnique:async()=>state.credential,create:async({data})=>{if(state.credential)throw Error('unique');state.credential={userId:'u1',...data};return state.credential;}},
    oAuthIdentity:{findFirst:async()=>google?{id:'google-id'}:null},
    transactionPinCredential:{findUnique:async()=>state.pin,create:async({data})=>{if(state.pin)throw Error('unique');state.pin={createdAt:now(),failedAttempts:0,lockedUntil:null,...data};return state.pin;},update:async({data})=>{for(const [k,v] of Object.entries(data))state.pin[k]=v;return state.pin;}},
    transactionPinResetChallenge:challengeModel(state.pinChallenges),
    passwordEnrollmentChallenge:challengeModel(state.enrollChallenges),
    session:{updateMany:async({where,data})=>{for(const session of state.sessions){if(session.status==='ACTIVE' && (!where.id || session.id!==where.id.not)){Object.assign(session,data);}}return{count:1};}},
    securityEvent:{create:async({data})=>state.events.push(data)},
  };
  const prisma={
    transactionPinCredential:tx.transactionPinCredential,passwordCredential:tx.passwordCredential,
    $transaction:async fn=>{
      const before=queue;
      let release;queue=new Promise(r=>{release=r;});
      await before;try{return await fn(tx);}finally{release();}
    },
  };
  const hasher={hash:async value=>`hash:${value}`,verify:async(hash,value)=>hash===`hash:${value}`};
  const notifications={enqueueWithTx:async(_tx,data)=>{state.notices.push(data);return{id:`notice-${state.notices.length}`};}};
  return {state,prisma, pin:new TransactionPinService(prisma,hasher,notifications), enroll:new PasswordEnrollmentService(prisma,hasher,notifications),getCode:()=>{const text=state.notices.at(-1)?.text??'';return text.match(/\b\d{8}\b/)?.[0];}};
}
const PIN='2586', NEW='6937';
test('PIN setup requires password and rejects weak PINs',async()=>{
  const h=harness();await assert.rejects(h.pin.setPin('u1','wrong',PIN),{message:'PIN_AUTHORIZATION_FAILED'});
  await assert.rejects(h.pin.setPin('u1','correct-password','1111'),{message:'PIN_WEAK_OR_INVALID'});
  assert.equal(await h.pin.status('u1'),'NOT_SET');
  assert.equal((await h.pin.setPin('u1','correct-password',PIN)).status,'SET');
  assert.equal(await h.pin.status('u1'),'SET');
  assert.ok(!JSON.stringify(h.state.pin).includes(PIN));
  await assert.rejects(h.pin.setPin('u1','correct-password',NEW),{message:'PIN_ALREADY_SET'});
});
test('independent PIN pepper must be configured; fail closed',async()=>{
  const h=harness();const prev=process.env.TRANSACTION_PIN_PEPPER;delete process.env.TRANSACTION_PIN_PEPPER;
  try{await assert.rejects(h.pin.setPin('u1','correct-password',PIN),{message:'TRANSACTION_PIN_PEPPER_REQUIRED'});}finally{process.env.TRANSACTION_PIN_PEPPER=prev;}
});
test('changing PIN requires both account password and old PIN',async()=>{
  const h=harness();await h.pin.setPin('u1','correct-password',PIN);
  await assert.rejects(h.pin.changePin('u1','wrong',PIN,NEW),{message:'PIN_AUTHORIZATION_FAILED'});
  await assert.rejects(h.pin.changePin('u1','correct-password',PIN,PIN),{message:'PIN_AUTHORIZATION_FAILED'});
  assert.equal((await h.pin.changePin('u1','correct-password',PIN,NEW)).status,'SET');
  assert.equal(h.state.pin.failedAttempts,0);
});
test('bad PIN is capped with persistent lockout; attempted changes cannot bypass it',async()=>{
  const h=harness();await h.pin.setPin('u1','correct-password',PIN);
  for(let i=0;i<4;i++)await assert.rejects(h.pin.changePin('u1','correct-password','7777',NEW),{message:'PIN_AUTHORIZATION_FAILED'});
  assert.equal(h.state.pin.failedAttempts,4);
  await assert.rejects(h.pin.changePin('u1','correct-password','7777',NEW),{message:'PIN_TEMPORARILY_LOCKED'});
  assert.equal(h.state.pin.failedAttempts,5);
  await assert.rejects(h.pin.changePin('u1','correct-password',PIN,NEW),{message:'PIN_TEMPORARILY_LOCKED'});
  assert.ok(h.state.pin.lockedUntil>new Date());
});
test('PIN reset email challenge is session bound, consumed only once, and revokes other sessions',async()=>{
  const h=harness();await h.pin.setPin('u1','correct-password',PIN);
  await assert.rejects(h.pin.requestReset('u1','s1','wrong'),{message:'PIN_AUTHORIZATION_FAILED'});
  assert.equal((await h.pin.requestReset('u1','s1','correct-password')).deliveryStatus,'PENDING');
  const code=h.getCode(); assert.match(code,/^\d{8}$/);
  await assert.rejects(h.pin.completeReset('u1','s2','correct-password',code,NEW),{message:'PIN_AUTHORIZATION_FAILED'});
  await assert.rejects(h.pin.completeReset('u1','s1','correct-password','00000000',NEW),{message:'PIN_AUTHORIZATION_FAILED'});
  assert.equal(h.state.pinChallenges[0].failedAttempts,1);
  assert.equal((await h.pin.completeReset('u1','s1','correct-password',code,NEW)).status,'SET');
  assert.equal(h.state.sessions.find(x=>x.id==='s2').status,'REVOKED');
  assert.equal(h.state.sessions.find(x=>x.id==='s1').status,'ACTIVE');
  await assert.rejects(h.pin.completeReset('u1','s1','correct-password',code,PIN),{message:'PIN_AUTHORIZATION_FAILED'});
});
test('PIN reset expiry and cap on OTP guesses are enforced',async()=>{
  const h=harness();await h.pin.setPin('u1','correct-password',PIN);
  await h.pin.requestReset('u1','s1','correct-password');const code=h.getCode();
  h.state.pinChallenges[0].expiresAt=new Date(Date.now()-100);
  await assert.rejects(h.pin.completeReset('u1','s1','correct-password',code,NEW),{message:'PIN_AUTHORIZATION_FAILED'});
  h.state.pinChallenges[0].expiresAt=new Date(Date.now()+600000);
  for(let i=0;i<5;i++)await assert.rejects(h.pin.completeReset('u1','s1','correct-password','99999999',NEW),{message:'PIN_AUTHORIZATION_FAILED'});
  assert.equal(h.state.pinChallenges[0].failedAttempts,5);
  await assert.rejects(h.pin.completeReset('u1','s1','correct-password',code,NEW),{message:'PIN_AUTHORIZATION_FAILED'});
});
test('PIN reset resend cooldown and concurrent requests permit a single challenge',async()=>{
  const h=harness();await h.pin.setPin('u1','correct-password',PIN);
  const result=await Promise.allSettled([h.pin.requestReset('u1','s1','correct-password'),h.pin.requestReset('u1','s1','correct-password')]);
  assert.equal(result.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(h.state.pinChallenges.length,1);
});
test('concurrent PIN resets cannot both consume the same email challenge',async()=>{
  const h=harness();await h.pin.setPin('u1','correct-password',PIN);await h.pin.requestReset('u1','s1','correct-password');const code=h.getCode();
  const result=await Promise.allSettled([h.pin.completeReset('u1','s1','correct-password',code,NEW),h.pin.completeReset('u1','s1','correct-password',code,'6285')]);
  assert.equal(result.filter(x=>x.status==='fulfilled').length,1);
});
test('Google-only enrollment requires verified email and a Google identity',async()=>{
  for(const options of [{google:false,hasPassword:false},{google:true,hasPassword:false,verified:false},{google:true,hasPassword:true}]){
    const h=harness(options);await assert.rejects(h.enroll.request('u1','s1'),{message:'PASSWORD_SETUP_UNAVAILABLE'});assert.equal(h.state.enrollChallenges.length,0);
  }
});
test('Google-only password enrollment uses session-bound challenge and revokes sessions',async()=>{
  const h=harness({hasPassword:false});assert.deepEqual(await h.enroll.status('u1'),{hasPassword:false});
  assert.equal((await h.enroll.request('u1','s1')).deliveryStatus,'PENDING');
  const code=h.getCode();assert.ok(code);
  await assert.rejects(h.enroll.complete('u1','s2',code,'secure-passphrase-24'),{message:'PASSWORD_SETUP_CODE_INVALID'});
  await assert.rejects(h.enroll.complete('u1','s1','12345678','secure-passphrase-24'),{message:'PASSWORD_SETUP_CODE_INVALID'});
  assert.equal(h.state.enrollChallenges[0].failedAttempts,1);
  assert.deepEqual(await h.enroll.complete('u1','s1',code,'secure-passphrase-24'),{ok:true});
  assert.equal(h.state.credential.passwordHash,'hash:secure-passphrase-24');
  assert.equal(h.state.sessions[0].status,'REVOKED');
  assert.equal(h.state.sessions[1].status,'REVOKED');
  assert.equal((await h.enroll.status('u1')).hasPassword,true);
  await assert.rejects(h.enroll.complete('u1','s1',code,'another-passphrase-24'),{message:'PASSWORD_SETUP_CODE_INVALID'});
});
test('expired or exhausted Google-only setup challenge cannot create password',async()=>{
  const h=harness({hasPassword:false});await h.enroll.request('u1','s1');const code=h.getCode();
  h.state.enrollChallenges[0].expiresAt=new Date(Date.now()-10);
  await assert.rejects(h.enroll.complete('u1','s1',code,'secure-passphrase-24'),{message:'PASSWORD_SETUP_CODE_INVALID'});
  h.state.enrollChallenges[0].expiresAt=new Date(Date.now()+600000);
  for(let i=0;i<5;i++)await assert.rejects(h.enroll.complete('u1','s1','99999999','secure-passphrase-24'),{message:'PASSWORD_SETUP_CODE_INVALID'});
  await assert.rejects(h.enroll.complete('u1','s1',code,'secure-passphrase-24'),{message:'PASSWORD_SETUP_CODE_INVALID'});
});
test('concurrent Google-only password completion consumes exactly once',async()=>{
  const h=harness({hasPassword:false});await h.enroll.request('u1','s1');const code=h.getCode();
  const results=await Promise.allSettled([h.enroll.complete('u1','s1',code,'secure-passphrase-24'),h.enroll.complete('u1','s1',code,'other-passphrase-24')]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
});
test('Google-only password enrollment throttles requests and rejects short passwords',async()=>{
  const h=harness({hasPassword:false});await h.enroll.request('u1','s1');
  await assert.rejects(h.enroll.request('u1','s1'),{message:'PASSWORD_SETUP_UNAVAILABLE'});
  await assert.rejects(h.enroll.complete('u1','s1',h.getCode(),'short'),{message:'PASSWORD_TOO_SHORT'});
});
const source = rel => readFileSync(resolve(root,rel),'utf8');
test('all new credential operations are guarded by authenticated contact-verified, CSRF protected sessions',()=>{
  const controller=source('apps/api/src/modules/auth/presentation/auth.controller.ts');
  const guard=source('apps/api/src/modules/auth/presentation/request-security.guard.ts');
  for(const endpoint of ['password/enrollment/request','password/enrollment/complete','transaction-pin/set','transaction-pin/change','transaction-pin/reset/request','transaction-pin/reset/complete']) {
    assert.ok(controller.includes(`@Post('${endpoint}')\n  @UseGuards(SessionAuthGuard)`), `missing guard on ${endpoint}`);
    assert.ok(!guard.includes(`'/v1/auth/${endpoint}'`),'credential changes may not bypass CSRF');
  }
  assert.match(source('apps/api/src/modules/auth/presentation/session-auth.guard.ts'),/contactVerified\(session\.user\)/);
});
test('customer API allowlist contains every new integrated endpoint',()=>{
  const routes=source('apps/customer-ui/src/lib/api/axios.ts');
  for(const endpoint of ['/auth/password/enrollment/status','/auth/password/enrollment/request','/auth/password/enrollment/complete','/auth/transaction-pin/status','/auth/transaction-pin/set','/auth/transaction-pin/change','/auth/transaction-pin/reset/request','/auth/transaction-pin/reset/complete'])assert.ok(routes.includes(`"${endpoint}"`));
});
test('PIN and account secret never travel in query parameters, and old PIN onboarding is retired',()=>{
  const controller=source('apps/api/src/modules/auth/presentation/auth.controller.ts');
  assert.match(controller, /PinChangeSchema = z\.object\(\{ password:.*oldPin:.*newPin:/);
  assert.match(controller, /PasswordEnrollmentSchema = z\.object\(\{ code:.*password:/);
  const legacy=source('apps/customer-ui/src/routes/auth-pages/SetTransactionPin.tsx');
  assert.match(legacy,/Navigate to="\/dashboard\/settings\/security"/);
  assert.doesNotMatch(legacy,/mutate\(|setTransactionPin\(/);
});
test('additive migrations do not modify financial ledger or wallet tables',()=>{
  const sql=source('packages/database/prisma/migrations/0009_account_security_transaction_pin/migration.sql');
  for(const table of ['transaction_pin_credentials','password_enrollment_challenges','transaction_pin_reset_challenges'])assert.match(sql,new RegExp(`CREATE TABLE "${table}"`));
  assert.doesNotMatch(sql,/DROP|ALTER TABLE "(?:wallet|ledger|journal|financial|provider)/i);
});
test('PIN changes are infrastructure-gated and credential flows have dedicated rate buckets',()=>{
  assert.match(source('apps/api/src/modules/auth/application/transaction-pin.service.ts'),/TRANSACTION_PIN_PEPPER_REQUIRED/);
  assert.match(source('apps/api/src/platform/config/env.ts'),/TRANSACTION_PIN_PEPPER: z\.string\(\)\.min\(32\)\.optional\(\)/);
  assert.match(source('apps/api/src/platform/http/risk-rate-limit.ts'),/bucket: 'transaction-pin', max: 6/);
  assert.match(source('apps/api/src/modules/auth/application/password-enrollment.service.ts'),/PASSWORD_ENROLLED/);
});
