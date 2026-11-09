/** Batch 4.4 offline behavioral tests; not PostgreSQL/provider/browser qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const root=resolve(import.meta.dirname,'../../..');
const source=(name)=>readFileSync(resolve(root,name),'utf8');
function load(name, dependencies={}, extra={}) {
  const output=ts.transpileModule(source(name), {fileName:name,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};
  new Function('require','module','exports',...Object.keys(extra),output)(id=>{
    if(!(id in dependencies))throw Error('Unexpected dependency '+id);
    return dependencies[id];
  },mod,mod.exports,...Object.values(extra));
  return mod.exports;
}
const {resolveDepositDestination}=load('apps/api/src/modules/finance/application/virtual-account-credit-destination.ts');
const account={id:'va-1',userId:'customer-1',providerCode:'paystack',accountReference:'va-ref-1',accountNumberFingerprint:'hash-1',status:'ACTIVE',currency:'NGN'};
const both={providerCode:'paystack',accountReference:'va-ref-1',accountNumberFingerprint:'hash-1',byReference:account,byNumber:account};
test('matching independently resolved ACTIVE deposit identifiers return the same customer account',()=>{
  assert.deepEqual(resolveDepositDestination(both),{ok:true,account});
});
test('one valid reference is sufficient only when no other identifier was supplied',()=>{
  assert.equal(resolveDepositDestination({...both,accountNumberFingerprint:undefined,byNumber:null}).ok,true);
});
test('one valid number is sufficient only when no reference was supplied',()=>{
  assert.equal(resolveDepositDestination({...both,accountReference:undefined,byReference:null}).ok,true);
});
test('missing both identifiers blocks credit',()=>{
  assert.deepEqual(resolveDepositDestination({...both,accountReference:undefined,accountNumberFingerprint:undefined,byReference:null,byNumber:null}),{ok:false,code:'ACCOUNT_UNMAPPED'});
});
test('unknown reference never silently falls back to valid account number',()=>{
  assert.deepEqual(resolveDepositDestination({...both,byReference:null}),{ok:false,code:'ACCOUNT_UNMAPPED'});
});
test('unknown number never silently falls back to valid account reference',()=>{
  assert.deepEqual(resolveDepositDestination({...both,byNumber:null}),{ok:false,code:'ACCOUNT_UNMAPPED'});
});
test('cross-customer reference and account number conflicts block deposit',()=>{
  assert.deepEqual(resolveDepositDestination({...both,byNumber:{...account,id:'va-2',userId:'customer-2'}}),{ok:false,code:'ACCOUNT_IDENTIFIERS_CONFLICT'});
});
test('inactive account and non-NGN routing fail closed',()=>{
  for(const status of ['PENDING','INACTIVE','FAILED']){
    assert.deepEqual(resolveDepositDestination({...both,byReference:{...account,status},byNumber:{...account,status}}),{ok:false,code:'ACCOUNT_NOT_ACTIVE'});
  }
  assert.deepEqual(resolveDepositDestination({...both,byReference:{...account,currency:'USD'},byNumber:{...account,currency:'USD'}}),{ok:false,code:'ACCOUNT_NOT_ACTIVE'});
});
test('provider and reference/fingerprint disagreements cannot be credited',()=>{
  for(const changed of [{providerCode:'monnify'},{accountReference:'other'},{accountNumberFingerprint:'other'}]){
    assert.equal(resolveDepositDestination({...both,byReference:{...account,...changed},byNumber:{...account,...changed}}).ok,false);
  }
});
test('wallet-credit service requires provider requery, active-account row lock, and identity recheck before posting',()=>{
  const text=source('apps/api/src/modules/finance/application/payment.service.ts');
  const method=text.slice(text.indexOf('async verifyAndSettleVirtualAccountCredit('));
  assert.match(method,/provider\.getCollection/);
  assert.match(method,/resolveDepositDestination/);
  assert.match(method,/FOR UPDATE/);
  assert.match(method,/lockedAccount\.status !== 'ACTIVE'/);
  assert.ok(method.indexOf('lockedAccount.status') < method.indexOf('this.ledger.postWithTx'));
});
function fakeStorage(){ const map=new Map(); return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),map}; }
const sessionStorage=fakeStorage();
const posts=[]; const gets=[];
const axios={
  post: async (url,body,config)=>{posts.push({url,body,config});return {data:{transactionReference:'fund:abc1',provider:body.provider,status:'PENDING',amountMinor:body.amountMinor,currency:'NGN',checkoutUrl:'https://checkout.paystack.com/abc'}}},
  get: async url=>{gets.push(url);return {data:{transaction:{reference:'fund:abc1',type:'FUNDING',status:'SUCCEEDED',currency:'NGN',amountMinor:'20000',updatedAt:new Date().toISOString()}}}}
};
const funding=load('apps/customer-ui/src/lib/api/dashboard-apis/funding.ts',{'../axios':{default:axios}}, {sessionStorage,crypto:require('node:crypto').webcrypto});
test('funding client rejects absent/malformed PIN before issuing a network call',async()=>{
  for(const pin of ['', '123','12345','abcd']) await assert.rejects(()=>funding.initiateFunding('paystack','200',pin));
  assert.equal(posts.length,0);
});
test('funding request uses minor-unit amount and backend-required PIN, but never persists PIN',async()=>{
  const result=await funding.initiateFunding('paystack','200','1234');
  assert.equal(result.status,'PENDING');
  assert.equal(posts[0].url,'/payments/collections');
  assert.deepEqual(posts[0].body,{provider:'paystack',amountMinor:'20000',currency:'NGN',transactionPin:'1234'});
  assert.match(posts[0].config.headers['Idempotency-Key'],/^twipay-fund:/);
  assert.equal(JSON.stringify([...sessionStorage.map]).includes('1234'),false);
  assert.equal(funding.lastFundingReference(),'fund:abc1');
});
test('read-only funding status accepts only owner-scoped validated funding response',async()=>{
  const status=await funding.getFundingStatus('fund:abc1');
  assert.equal(status.status,'SUCCEEDED');
  assert.equal(gets[0],'/transactions/fund%3Aabc1');
  await assert.rejects(()=>funding.getFundingStatus('../users'));
});
test('funding checkout URL remains provider allowlisted, never proof of wallet credit',()=>{
  assert.equal(funding.safeCheckoutUrl('https://evil.paystack.com.evil.test','paystack'),null);
  assert.equal(funding.safeCheckoutUrl('http://checkout.paystack.com/ref','paystack'),null);
  assert.equal(funding.safeCheckoutUrl('https://checkout.paystack.com/ref','paystack')!==null,true);
});
test('virtual-account UI must require the backend PIN, never persist it in retry storage',()=>{
  const client=source('apps/customer-ui/src/lib/api/dashboard-apis/virtualAccounts.ts');
  const page=source('apps/customer-ui/src/components/dashboard/static-account/CreateStaticAccount.tsx');
  assert.match(client,/transactionPin: string/);
  assert.match(client,/test\(value\.transactionPin\)/);
  assert.match(page,/type="password"/);
  assert.match(page,/transactionPin:pin/);
  const backend=source('apps/api/src/modules/finance/presentation/finance.controller.ts');
  assert.match(backend,/intent: 'VIRTUAL_ACCOUNT'/);
  assert.match(backend,/intent: 'FUNDING'/);
});

// Exercise the actual PaymentService routing before any wallet/journal mock can run.
function makeCollectionService({accountRef=account,accountNumber=account,status='SUCCEEDED'}={}) {
  const events={cases:[],transactions:0,queries:[]};
  const registry={get:()=>({getCollection:async()=>({status,amountMinor:20000n,currency:'NGN',providerReference:'p-ref'})})};
  const db={
    virtualAccount:{findUnique:async ({where})=>{events.queries.push(where);return where.providerCode_accountReference?accountRef:accountNumber;}},
    reconciliationCase:{create:async ({data})=>{events.cases.push(data);return {}}},
    $transaction:async()=>{events.transactions++;throw Error('WRONG: reached financial transaction without valid destination');},
  };
  const exports=load('apps/api/src/modules/finance/application/payment.service.ts', {
    '@nestjs/common':{Injectable:()=>target=>target,Logger:class{error(){}}},'node:crypto':require('node:crypto'),
    '@twipay/security':{fingerprintSensitiveValue:()=> 'hash-1'},
    './reference.js':{createFinancialReference:()=> 'unused'},
    './virtual-account-credit-destination.js':{resolveDepositDestination},
  });
  return {service:new exports.PaymentService(db,{},registry,{}, {},{},{}),events};
}
const credit={collectionReference:'collection-1',providerReference:'p-ref',accountReference:'va-ref-1',accountNumber:'1234567890',amountMinor:20000n,currency:'NGN'};
test('actual payment service refuses misrouted virtual-account credit before opening a wallet transaction',async()=>{
  const {service,events}=makeCollectionService({accountNumber:{...account,id:'another-account',userId:'customer-2'}});
  await service.verifyAndSettleVirtualAccountCredit('paystack',credit);
  assert.equal(events.transactions,0);
  assert.equal(events.cases[0].type,'PROVIDER_STATUS_MISMATCH');
  assert.equal(events.cases[0].evidence.accountNumberLast4,'7890');
});
test('actual payment service rejects inactive accounts and unknown references before posting ledger',async()=>{
  for(const setup of [{accountRef:{...account,status:'INACTIVE'},accountNumber:{...account,status:'INACTIVE'}},{accountRef:null}]){
    const {service,events}=makeCollectionService(setup);
    await service.verifyAndSettleVirtualAccountCredit('paystack',credit);
    assert.equal(events.transactions,0);
    assert.equal(events.cases.length,1);
  }
});
