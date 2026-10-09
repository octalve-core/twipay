import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = new URL('../../../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8');
const source = read('apps/customer-ui/src/lib/api/dashboard-apis/funding.ts');
const apiSource = read('apps/api/src/modules/finance/presentation/finance.controller.ts');
const paymentSource = read('apps/api/src/modules/finance/application/payment.service.ts');
const calls = [];
const storage = new Map();
const clock = {value: Date.now()};
const crypto = {randomUUID: ()=>'11111111-2222-4333-8444-555555555555'};
const fakeApi={post:async(...args)=>{
  calls.push(args);
  return {data:{transactionReference:'fund:sample_123',provider:'paystack',status:'PENDING',amountMinor:'10025',currency:'NGN',checkoutUrl:'https://checkout.paystack.com/demo'}};
}};
const compiled = ts.transpileModule(source,{fileName:'funding.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports = {};
vm.runInNewContext(compiled,{exports,crypto,URL,Date,Number,BigInt,String,Error,TypeError,JSON,sessionStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},require:(name)=>{
  assert.equal(name,'../axios');return {__esModule:true,default:fakeApi};
}});
const f=exports;
test('C2 exact amount parser rejects rounding, negatives, exponent and provider unsafe overflow',()=>{
  assert.equal(f.nairaToMinor('100.25'),'10025');
  assert.equal(f.nairaToMinor('0.01'),'1');
  assert.equal(f.nairaToMinor('90071992547409.91'),'9007199254740991');
  for(const value of ['-500','0','0.00','1.001','1e4','Infinity','2,000','2.','.50','90071992547409.92','1.\n2']) assert.throws(()=>f.nairaToMinor(value));
});
test('C2 idempotency key is stable across same logical attempts and retries',()=>{
  const a=f.fundingAttempt('paystack','10025');
  assert.match(a,/^twipay-fund:[0-9a-f-]{36}$/);
  assert.equal(f.fundingAttempt('paystack','10025'),a);
  assert.throws(()=>f.fundingAttempt('monnify','10025'),/different funding/);
  assert.throws(()=>f.fundingAttempt('paystack','20000'),/different funding/);
});
test('C2 collection sends one authorized shape to the real TwiPay API',async()=>{
  const result=await f.initiateFunding('paystack','100.25');
  assert.equal(result.transactionReference,'fund:sample_123');
  const [url,payload,options]=calls.at(-1);
  assert.equal(url,'/payments/collections');
  assert.deepEqual(JSON.parse(JSON.stringify(payload)),{provider:'paystack',amountMinor:'10025',currency:'NGN'});
  assert.equal(options.headers['Idempotency-Key'],f.fundingAttempt('paystack','10025'));
});
test('C2 refuses fake statuses, mismatched amount, tampered providers and fabricated checkout data',()=>{
  const good={transactionReference:'fund-10',provider:'paystack',status:'PENDING',amountMinor:'10025',currency:'NGN'};
  for (const change of [{status:'PAID'},{provider:'monnify'},{amountMinor:'20000'},{currency:'USD'},{transactionReference:'../../a'},{checkoutUrl:42}]) {
    assert.throws(()=>f.validateFundingInitiation({...good,...change},'paystack','10025'));
  }
  assert.equal(f.validateFundingInitiation({...good,status:'UNKNOWN'},'paystack','10025').status,'UNKNOWN');
});
test('C2 checkout allowlist refuses attacker hosts, http, credentials and port smuggling',()=>{
  assert.equal(f.safeCheckoutUrl('https://checkout.paystack.com/start','paystack'),'https://checkout.paystack.com/start');
  assert.equal(f.safeCheckoutUrl('https://sandbox.monnify.com/pay','monnify'),'https://sandbox.monnify.com/pay');
  for(const link of ['javascript:alert(1)','http://checkout.paystack.com','https://paystack.com.evil.tld/','https://evil.tld/?paystack.com','https://checkout.paystack.com:444/','https://user:pwd@checkout.paystack.com/','https://sandbox.monnify.com/']) {
    assert.equal(f.safeCheckoutUrl(link,'paystack'),null);
  }
});
test('C2 legacy external-wallet collection route remains disabled, integration allowlist is narrow',()=>{
  const a=read('apps/customer-ui/src/lib/api/axios.ts');
  const w=read('apps/customer-ui/src/lib/api/dashboard-apis/walletApis.ts');
  assert.match(a,/"\/payments\/collections"/);
  assert.doesNotMatch(a,/"\/wallet\/fund"/);
  assert.doesNotMatch(w,/"\/wallet\/fund"/);
});
test('C2 server-side collection gate is disabled by default and forbidden in production',()=>{
  assert.match(apiSource,/WALLET_COLLECTIONS_SANDBOX_ENABLED/);
  assert.match(apiSource,/NODE_ENV'\] === 'production'/);
  assert.match(apiSource,/PAYSTACK_SANDBOX_KEY_REQUIRED/);
  assert.match(apiSource,/MONNIFY_SANDBOX_REQUIRED/);
  assert.match(read('apps/api/src/platform/config/env.ts'),/WALLET_COLLECTIONS_SANDBOX_ENABLED.*default\('false'\)/);
  assert.match(read('.env.example'),/WALLET_COLLECTIONS_SANDBOX_ENABLED=false/);
  assert.match(read('apps/customer-ui/.env.example'),/VITE_TWIPAY_FUNDING_SANDBOX_ENABLED=false/);
});
test('C2 provider evidence and ledger settlement stay server-authoritative',()=>{
  assert.match(paymentSource,/verifyAndSettleCollection/);
  assert.match(paymentSource,/provider\.getCollection/);
  assert.match(paymentSource,/verified\.amountMinor !== financial\.amountMinor/);
  assert.match(paymentSource,/verified\.currency !== financial\.currency/);
  assert.match(paymentSource,/jrn:\$\{financial\.reference\}:funding/);
  assert.match(paymentSource,/ledger\.postWithTx/);
  assert.match(paymentSource,/PROVIDER_CALL_OUTCOME_UNKNOWN/);
});
test('C2 original add-funds steps remain, with no invented bank-account details',()=>{
  const step=read('apps/customer-ui/src/components/dashboard/add-funds/MakePayment.tsx');
  const form=read('apps/customer-ui/src/components/dashboard/add-funds/SelectPaymentMethod.tsx');
  assert.match(step,/safeCheckoutUrl/);
  assert.match(step,/Checking payment status/);
  assert.doesNotMatch(step,/paymentDetails\.accountNumber/);
  assert.match(form,/VITE_TWIPAY_FUNDING_SANDBOX_ENABLED/);
  assert.match(read('apps/customer-ui/src/App.tsx'),/"\/wallet\/fund\/complete"/);
});
