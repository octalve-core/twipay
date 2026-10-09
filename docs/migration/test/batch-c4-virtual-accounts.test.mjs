import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const root=new URL('../../../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const storage=new Map();
const calls=[];
const fakeApi={
  get:async path=>{
    calls.push({path});
    if(path.endsWith('validation-banks')) return {data:{provider:'paystack',banks:[{bankCode:'058',name:'Sample Bank'}]}};
    return {data:{virtualAccounts:[{provider:'monnify',reference:'va-abc',status:'ACTIVE',accountNumber:'1234567890',accountName:'Test Owner',bankName:'Sandbox Bank',currency:'NGN'}],provisioning:[{provider:'monnify',reference:'va-abc',status:'SUCCEEDED',createdAt:'2026-10-08T00:00:00.000Z'}]}};
  },
  post:async(path,payload,opts)=>{calls.push({path,payload,opts});return {data:{provider:payload.provider,reference:'va-abc',status:'PENDING'}};},
};
const code=ts.transpileModule(read('apps/customer-ui/src/lib/api/dashboard-apis/virtualAccounts.ts')
  .replace(/import\.meta\.env\.VITE_TWIPAY_VIRTUAL_ACCOUNT_SANDBOX_ENABLED/g,"'true'"),
  {fileName:'virtualAccounts.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};
vm.runInNewContext(code,{exports,require:id=>{if(id==='../axios')return {__esModule:true,default:fakeApi};throw Error(id)},
  sessionStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  crypto:webcrypto,Date,Math,JSON,String,Number,RegExp,Set,TypeError,Error,URL,Array,Boolean});
const a=exports;
test('C4 user-scoped GET parses actual account assignments and provisioning state',async()=>{
  const result=await a.listVirtualAccounts();
  assert.equal(result.virtualAccounts[0].accountNumber,'1234567890');
  assert.equal(result.provisioning[0].status,'SUCCEEDED');
  assert.equal(calls.at(-1).path,'/virtual-accounts');
});
test('C4 rejects missing assignments, forged ACTIVE accounts and untrusted statuses',()=>{
  const good={virtualAccounts:[],provisioning:[]};
  assert.deepEqual(JSON.parse(JSON.stringify(a.parseVirtualAccounts(good))),good);
  for (const change of [null,{virtualAccounts:[]},{virtualAccounts:[{status:'ACTIVE'}],provisioning:[]},
    {virtualAccounts:[],provisioning:[{provider:'paystack',reference:'x',status:'CONFIRMED',createdAt:new Date().toISOString()}]}]){
    assert.throws(()=>a.parseVirtualAccounts(change));
  }
  assert.equal(a.parseVirtualAccountResult({provider:'paystack',reference:'va-987',status:'INACTIVE'},'paystack').status,'INACTIVE');
  assert.equal(a.parseVirtualAccounts({virtualAccounts:[],provisioning:[{provider:'paystack',reference:'va-123',status:'REVERSED',createdAt:'2026-10-08T00:00:00Z'}]}).provisioning[0].status,'REVERSED');
  for (const bad of [{status:'SUCCESS'}, {status:'ACTIVE'}, {provider:'fake'}, {reference:'../../vault'}]) {
    assert.throws(()=>a.parseVirtualAccountResult({...{provider:'monnify',reference:'va-123',status:'PENDING'},...bad},'monnify'));
  }
});
test('C4 validation bank directory only accepts actual Paystack codes and bank names',async()=>{
  const banks=await a.listVirtualAccountValidationBanks();
  assert.equal(banks[0].bankCode,'058');
  assert.equal(calls.at(-1).path,'/virtual-accounts/validation-banks');
  assert.throws(()=>a.parseValidationBanks({provider:'other',banks:[]}));
  assert.throws(()=>a.parseValidationBanks({provider:'paystack',banks:[{bankCode:'<x>',name:'x'}]}));
});
test('C4 provider consent and Paystack personal bank validation required',()=>{
  for (const input of [
    {provider:'monnify',consent:false},
    {provider:'unknown',consent:true},
    {provider:'paystack',consent:true,transactionPin:'1234',validationBankCode:'058',validationAccountNumber:'123'},
    {provider:'monnify',consent:true,transactionPin:'1234',validationAccountNumber:'1234567890'},
    {provider:'paystack',consent:true,transactionPin:'1234',validationBankCode:'058',validationAccountNumber:'notanumber1234'},
  ]) assert.throws(()=>a.validateVirtualAccountInput(input));
  assert.doesNotThrow(()=>a.validateVirtualAccountInput({provider:'monnify',consent:true,transactionPin:'1234'}));
  assert.doesNotThrow(()=>a.validateVirtualAccountInput({provider:'paystack',consent:true,transactionPin:'1234',validationBankCode:'058',validationAccountNumber:'1234567890'}));
});
test('C4 retries keep one idempotency key without storing BVN or bank account',async()=>{
  const first=await a.provisionVirtualAccount({provider:'paystack',consent:true,transactionPin:'1234',validationBankCode:'058',validationAccountNumber:'1234567890'});
  assert.equal(first.status,'PENDING');
  assert.equal(calls.at(-1).path,'/virtual-accounts');
  const key=calls.at(-1).opts.headers['Idempotency-Key'];
  assert.match(key,/^twipay-va:[0-9a-f-]{36}$/);
  await a.provisionVirtualAccount({provider:'paystack',consent:true,transactionPin:'1234',validationBankCode:'058',validationAccountNumber:'1234567890'});
  assert.equal(calls.at(-1).opts.headers['Idempotency-Key'],key);
  assert.doesNotMatch([...storage.values()].join(' '),/1234567890|BVN|NIN|058|1234/);
});
test('C4 cannot silently switch providers with pending idempotency intent',()=>{
  assert.throws(()=>a.virtualAccountIdempotencyKey('monnify'),/Review your existing/);
  a.abandonVirtualAccountIntent();
  assert.equal(a.hasVirtualAccountIntent(),false);
  assert.match(a.virtualAccountIdempotencyKey('monnify'),/^twipay-va:/);
});
test('C4 backend gates provider writes independently of frontend and never permits production',()=>{
  const ctrl=read('apps/api/src/modules/finance/presentation/finance.controller.ts');
  const cfg=read('apps/api/src/platform/config/env.ts');
  assert.match(ctrl,/VIRTUAL_ACCOUNTS_SANDBOX_ENABLED/);
  assert.match(ctrl,/NODE_ENV'\] === 'production'/);
  assert.match(ctrl,/this\.assertVirtualAccountSandbox\(body\.provider\)/);
  assert.match(ctrl,/this\.assertVirtualAccountSandbox\('paystack'\)/);
  assert.match(ctrl,/PAYSTACK_SANDBOX_KEY_REQUIRED/);
  assert.match(ctrl,/MONNIFY_SANDBOX_REQUIRED/);
  assert.match(cfg,/VIRTUAL_ACCOUNTS_SANDBOX_ENABLED.*default\('false'\)/);
  assert.match(read('.env.example'),/VIRTUAL_ACCOUNTS_SANDBOX_ENABLED=false/);
  assert.match(read('apps/customer-ui/.env.example'),/VITE_TWIPAY_VIRTUAL_ACCOUNT_SANDBOX_ENABLED=false/);
});
test('C4 API enforces BVN, consent and owner-scoped lists, webhooks retain provider evidence',()=>{
  const ctrl=read('apps/api/src/modules/finance/presentation/finance.controller.ts');
  const svc=read('apps/api/src/modules/finance/application/virtual-account.service.ts');
  const payments=read('apps/api/src/modules/finance/application/payment.service.ts');
  assert.match(ctrl,/consent: z\.literal\(true\)/);
  assert.match(ctrl,/userId: principal\.userId/);
  assert.match(ctrl,/requireIdempotencyKey\(idempotencyKey\)/);
  assert.match(svc,/type: 'BVN'/);
  assert.match(svc,/status: 'VERIFIED'/);
  assert.match(svc,/VERIFIED_BVN_REQUIRED/);
  assert.match(svc,/idempotency\.begin/);
  assert.match(svc,/where: \{ userId, type: 'VIRTUAL_ACCOUNT' \}/);
  assert.match(svc,/take: 20/);
  assert.match(svc,/encryptSensitiveString/);
  assert.match(payments,/verifyAndSettleVirtualAccountCredit/);
});
test('C4 original ErhaPay static-account appearance is preserved but old OTP and foreign APIs are absent from active route',()=>{
  const route=read('apps/customer-ui/src/routes/dashboard/StaticAccount.tsx');
  const create=read('apps/customer-ui/src/components/dashboard/static-account/CreateStaticAccount.tsx');
  const details=read('apps/customer-ui/src/components/dashboard/static-account/StaticAccountDetails.tsx');
  for(const text of ['max-w-[410px]','CreateStaticAccount','StaticAccountDetails']) assert.ok(route.includes(text));
  for(const text of ['text-[#112929]','Create static account','/dashboard/settings/identity-verification']) assert.ok(create.includes(text));
  for(const text of ['AccountCardItem','Owner name','Account number','Bank name']) assert.ok(details.includes(text));
  assert.doesNotMatch(create,/validateIdentity|validateIdentityOtp|identityId|VerifyValidationOtp|\bBVN\b.*register\(/);
  assert.doesNotMatch(route,/bvnValidated|bvnVerified/);
  assert.match(route,/list\.isError/);
  assert.match(route,/provisioning/);
});
