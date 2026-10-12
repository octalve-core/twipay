/** Phase 3.5: execute actual KYC and auth-service TypeScript with isolated provider/Prisma seams.
 * NOT live Mono, PostgreSQL isolation, or React/browser qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const root=resolve(import.meta.dirname,'../../..');
class HttpError extends Error { constructor(value,status){super(value?.code??'ERROR'); this.status=status;} }
const nest={Injectable:()=>c=>c,NotFoundException:class extends HttpError{constructor(v){super(v,404);}},HttpException:HttpError, HttpStatus:{TOO_MANY_REQUESTS:429}};
function load(rel){
  const file=resolve(root,rel);
  const source=readFileSync(file,'utf8');
  const js=ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true}}).outputText;
  const module={exports:{}};
  new Function('require','module','exports',js)(name=>{
    if(name==='@nestjs/common')return nest;
    if(name==='@twipay/security')return {encryptSensitiveString:()=> 'encrypted', fingerprintSensitiveValue:()=> 'fingerprint',normalizeEmail:x=>x,validatePasswordPolicy:()=>[]};
    if(name==='../../finance/application/reference.js')return {createFinancialReference:()=> 'kyc-example'};
    throw Error(`Unexpected import ${name}`);
  },module,module.exports);
  return module.exports;
}
const {KycService}=load('apps/api/src/modules/kyc/application/kyc.service.ts');
const {AuthService}=load('apps/api/src/modules/auth/application/auth.service.ts');
const t=()=>new Date();
function kycHarness(records){
  const calls=[];
  const prisma={identityVerification:{
    findMany:async({where})=>records.filter(row=>row.userId===where.userId),
    findFirst:async({where})=>records.find(row=>row.id===where.id&&row.userId===where.userId)??null,
    update:async({where,data})=>{const record=records.find(row=>row.id===where.id);Object.assign(record,data);return record;},
  }};
  const provider={continueIdentityCheck:async input=>{calls.push(input);return {status:'PENDING',rawStatus:'otp_requested'};}};
  const idem={begin:async()=>({recordId:'idem1'}),complete:async()=>{},fail:async()=>{}};
  return {service:new KycService(prisma,{get:()=>provider},idem),records,calls};
}
function row(input={}){return {id:'kyc1',userId:'owner',type:'BVN',status:'AWAITING_CONSENT',providerCode:'mono',providerReference:'p1',identifierLast4:'1234',identifierCiphertext:'encrypted',identifierFingerprint:'digest',expiresAt:new Date(Date.now()+60000),result:{verificationMethods:['SMS','EMAIL'],otpRequested:false,providerStatus:'secret-details'},createdAt:t(),updatedAt:t(),...input};}
test('history is ownership filtered and never leaks provider result, raw identifier, or OTP',async()=>{
  const h=kycHarness([row(),row({id:'other',userId:'other-user',identifierLast4:'9999'})]);
  const history=await h.service.status('owner');
  assert.equal(history.length,1);assert.equal(history[0].id,'kyc1');
  assert.deepEqual(history[0].verificationMethods,['SMS','EMAIL']);
  assert.ok(!JSON.stringify(history).includes('secret-details'));assert.ok(!JSON.stringify(history).includes('encrypted'));
});
test('expired consent cannot be resumed and appears expired, not verified',async()=>{
  const h=kycHarness([row({expiresAt:new Date(Date.now()-60000)})]);
  const history=await h.service.status('owner');assert.equal(history[0].status,'EXPIRED');
  assert.deepEqual(history[0].verificationMethods,[]);
  await assert.rejects(h.service.continue({userId:'owner',verificationId:'kyc1',action:'REQUEST_OTP',verificationMethod:'SMS',idempotencyKey:'x'}),{message:'KYC_VERIFICATION_EXPIRED'});
  assert.equal(h.calls.length,0);
});
test('other users cannot continue owner KYC',async()=>{
  const h=kycHarness([row()]);
  await assert.rejects(h.service.continue({userId:'other-user',verificationId:'kyc1',action:'REQUEST_OTP',verificationMethod:'SMS',idempotencyKey:'x'}),{status:404});
  assert.equal(h.calls.length,0);
});
test('unadvertised provider methods and unsolicited OTPs are blocked server-side',async()=>{
  const h=kycHarness([row()]);
  await assert.rejects(h.service.continue({userId:'owner',verificationId:'kyc1',action:'REQUEST_OTP',verificationMethod:'WHATSAPP',idempotencyKey:'x'}),{message:'KYC_VERIFICATION_METHOD_UNAVAILABLE'});
  await assert.rejects(h.service.continue({userId:'owner',verificationId:'kyc1',action:'SUBMIT_OTP',otp:'123456',idempotencyKey:'y'}),{message:'KYC_OTP_NOT_REQUESTED'});
  assert.equal(h.calls.length,0);
});
test('persisted provider method allows genuine OTP request and later resumption',async()=>{
  const h=kycHarness([row()]);
  const v=await h.service.continue({userId:'owner',verificationId:'kyc1',action:'REQUEST_OTP',verificationMethod:'SMS',idempotencyKey:'z'});
  assert.equal(v.body.status,'PENDING');assert.equal(h.calls[0].verificationMethod,'SMS');
  const history=await h.service.status('owner');assert.equal(history[0].otpRequested,true);
});
test('unsafe provider metadata is filtered from resumption method list',async()=>{
  const h=kycHarness([row({result:{verificationMethods:['SMS',5,'', 'x'.repeat(41), 'SMS', 'EMAIL'],otpRequested:false,rawProviderData:'secret'}})]);
  const history=await h.service.status('owner');
  assert.deepEqual(history[0].verificationMethods,['SMS','EMAIL']);assert.ok(!JSON.stringify(history).includes('rawProviderData'));
});
test('customer profile update writes only requested optional fields',async()=>{
  let seen;const auth=new AuthService({user:{update:async input=>{seen=input;return {id:'owner',...input.data};}}},{},{},{});
  await auth.updateProfile('owner',{countryCode:'NG',stateRegion:'Ondo'});
  assert.deepEqual(seen.where,{id:'owner'});
  assert.deepEqual(seen.data,{countryCode:'NG',stateRegion:'Ondo'});
  assert.equal(seen.select.countryCode,true);
});
test('Prisma and API contracts enforce optional location without bypassing eligibility',()=>{
  const schema=readFileSync(resolve(root,'packages/database/prisma/schema.prisma'),'utf8');
  const migration=readFileSync(resolve(root,'packages/database/prisma/migrations/0010_profile_and_kyc_continuity/migration.sql'),'utf8');
  const controller=readFileSync(resolve(root,'apps/api/src/modules/auth/presentation/auth.controller.ts'),'utf8');
  const guard=readFileSync(resolve(root,'apps/api/src/modules/auth/presentation/session-auth.guard.ts'),'utf8');
  assert.match(schema,/countryCode\s+String\?/);assert.match(schema,/stateRegion\s+String\?/);
  assert.match(migration,/ALTER TABLE "users"/);assert.doesNotMatch(migration,/\b(?:wallets|ledger|financial_transactions)\b/i);
  assert.match(controller,/countryCode: z\.string\(\)\.regex/);assert.match(controller,/@Patch\('me'\)\s*@UseGuards\(SessionAuthGuard\)/);
  assert.match(guard,/CONTACT_VERIFICATION_REQUIRED/);
});
