import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { webcrypto } from 'node:crypto';
const require = createRequire(import.meta.url);
const ts=require('typescript');
const root = new URL('../../../',import.meta.url);
const read = p=>fs.readFileSync(new URL(p,root),'utf8');
const calls=[];
const storage=new Map();
const fakeApi={get:async (path,options)=>{
  calls.push({path,options});
  return {data:{provider:options.params.provider,banks:[{bankCode:'058',name:'Demo Bank'}]}};
},post:async (path,payload,options)=>{
  calls.push({path,payload,options});
  if(path==='/transfers/resolve-account')return {data:{account:{providerCode:'paystack',bankCode:'058',accountNumber:'******1234',accountName:'Example Beneficiary',currency:'NGN'}}};
  return {data:{transactionReference:'xfer:abcdef',provider:'paystack',status:'PROCESSING',amountMinor:'10025',feeMinor:'150',totalDebitMinor:'10175',currency:'NGN',beneficiary:{bankCode:'058',accountNumber:'******1234',accountName:'Example Beneficiary'}}};
}};
const storageShim={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const source=read('apps/customer-ui/src/lib/api/dashboard-apis/transfers.ts');
// The Vite-specific compile-time flag is set in this isolated simulation only.
const compiled=ts.transpileModule(source.replace(/import\.meta\.env\.VITE_TWIPAY_TRANSFER_SANDBOX_ENABLED/g,"'true'"),{
  fileName:'transfers.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const exports={};
vm.runInNewContext(compiled,{
  exports,require:(id)=>{
    if(id==='../axios')return {__esModule:true,default:fakeApi};
    if(id==='./funding')return {nairaToMinor:value=>{
      if(!/^(?:0|[1-9]\d{0,13})(?:\.\d{1,2})?$/.test(value))throw new Error('invalid money');
      const [a,b='']=value.split('.');const minor=BigInt(a)*100n+BigInt(b.padEnd(2,'0'));
      if(minor<1n||minor>9007199254740991n)throw new Error('money range');return String(minor);
    }};
    throw Error('unexpected require: '+id);
  },crypto:webcrypto,TextEncoder,Uint8Array,sessionStorage:storageShim,BigInt,Number,String,Date,JSON,Set,TypeError,Error,RegExp,URL,
});
const f=exports;
const transfer={provider:'paystack',bankCode:'058',accountNumber:'1234561234',accountName:'Example Beneficiary',amountNaira:'100.25',narration:'Wallet bank transfer'};
const quote={quoteToken:'x'.repeat(100),quoteId:'0b8b42d6-0f85-4d50-a2f9-44a066b32ae4',expiresAt:new Date(Date.now()+240000).toISOString(),provider:'paystack',bankCode:'058',accountName:'Example Beneficiary',accountNumberMasked:'******1234',amountMinor:'10025',feeMinor:'150',totalDebitMinor:'10175',currency:'NGN'};
test('C3 resolves only exact 10-digit NUBAN and verified provider bank code',async()=>{
  const a=await f.resolveBankAccount('paystack','058','1234561234');
  assert.equal(a.accountName,'Example Beneficiary');
  assert.equal(calls.at(-1).path,'/transfers/resolve-account');
  assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1).payload)),{provider:'paystack',bankCode:'058',accountNumber:'1234561234',currency:'NGN'});
  await assert.rejects(()=>f.resolveBankAccount('paystack','058','1234'));
  await assert.rejects(()=>f.resolveBankAccount('other','058','1234561234'));
});
test('C3 transfer uses same idempotency key on retry and never stores plaintext bank account',async()=>{
  const first=await f.initiateBankTransfer(transfer,'1234',quote);
  assert.equal(first.status,'PROCESSING');
  assert.equal(first.transactionReference,'xfer:abcdef');
  assert.equal(calls.at(-1).path,'/transfers');
  assert.equal(calls.at(-1).payload.amountMinor,'10025');
  assert.equal(calls.at(-1).payload.expectedAccountName,'Example Beneficiary');
  assert.equal(calls.at(-1).payload.transactionPin,'1234');
  assert.equal(calls.at(-1).payload.quoteToken,quote.quoteToken);
  const a=calls.at(-1).options.headers['Idempotency-Key'];
  assert.match(a,/^twipay-payout:[a-f0-9-]{36}$/);
  await f.initiateBankTransfer(transfer,'1234',quote);
  assert.equal(calls.at(-1).options.headers['Idempotency-Key'],a);
  assert.doesNotMatch([...storage.values()].join(' '),/1234561234|Example Beneficiary/);
});
test('C3 rejects changing recipient, amount, narration or provider without explicit reset',async()=>{
  for(const other of [{accountNumber:'1234561235'},{amountNaira:'100.26'},{provider:'monnify'},{narration:'Another transfer'}]) {
    await assert.rejects(()=>f.transferAttempt({...transfer,...other}),/different transfer/);
  }
  assert.equal(f.hasTransferAttempt(),true);
  f.abandonTransferAttempt();
  assert.equal(f.hasTransferAttempt(),false);
  assert.notEqual(await f.transferAttempt(transfer),'');
});
test('C3 validation refuses forged provider, beneficiary, amount and final status',()=>{
  const good={transactionReference:'xfer:abcdef',provider:'paystack',status:'UNKNOWN',amountMinor:'10025',currency:'NGN'};
  assert.equal(f.validateTransferResponse(good,transfer).status,'UNKNOWN');
  for(const change of [{status:'PAID'},{status:'completed'},{provider:'monnify'},{amountMinor:'10026'},{currency:'USD'},{transactionReference:'../../secret'},{beneficiary:{bankCode:'058',accountNumber:'******1235',accountName:'Example Beneficiary'}},{beneficiary:{bankCode:'058',accountNumber:'******1234',accountName:'Attacker'}}]){
    assert.throws(()=>f.validateTransferResponse({...good,...change},transfer));
  }
});
test('C3 backend independently gates both bank resolution and payout, never production',()=>{
  const ctrl=read('apps/api/src/modules/finance/presentation/finance.controller.ts');
  assert.match(ctrl,/BANK_TRANSFERS_SANDBOX_ENABLED/);
  assert.match(ctrl,/NODE_ENV'\] === 'production'/);
  assert.ok((ctrl.match(/this\.assertBankTransferSandbox\(body\.provider\)/g)||[]).length>=4);
  assert.match(ctrl,/amountMinor: totalDebitMinor, intent: 'TRANSFER'/);
  assert.match(ctrl,/PAYSTACK_SANDBOX_KEY_REQUIRED/);
  assert.match(ctrl,/MONNIFY_SANDBOX_REQUIRED/);
  assert.match(read('apps/api/src/platform/config/env.ts'),/BANK_TRANSFERS_SANDBOX_ENABLED.*default\('false'\)/);
  assert.match(read('.env.example'),/BANK_TRANSFERS_SANDBOX_ENABLED=false/);
  assert.match(read('apps/customer-ui/.env.example'),/VITE_TWIPAY_TRANSFER_SANDBOX_ENABLED=false/);
});
test('C3 bank payout checks expected beneficiary against fresh server-side provider resolution',()=>{
  const svc=read('apps/api/src/modules/finance/application/transfer.service.ts');
  const ctrl=read('apps/api/src/modules/finance/presentation/finance.controller.ts');
  assert.match(ctrl,/expectedAccountName: body\.expectedAccountName/);
  assert.match(svc,/BENEFICIARY_NAME_CHANGED/);
  assert.match(svc,/provider\.resolveBankAccount/);
  assert.match(svc,/idempotency\.begin/);
  assert.match(svc,/reserveWithTx/);
  assert.match(svc,/PAYOUT_CALL_OUTCOME_UNKNOWN/);
  assert.match(svc,/wallet hold intentionally retained/);
  assert.match(svc,/getPayout\(/);
  assert.match(svc,/Verified external bank payout/);
  assert.match(svc,/PAYOUT_PROVIDER_REVERSED/);
});
test('C3 cannot treat a pending or unknown provider response as successful transfer',()=>{
  const ui=read('apps/customer-ui/src/components/dashboard/withdraw-funds/Status.tsx');
  assert.match(ui,/txnResult\?\.status==='SUCCEEDED'/);
  assert.match(ui,/Transfer awaiting confirmation/);
  assert.doesNotMatch(ui,/txnResult \? SuccessIcon/);
});
test('C3 original ErhaPay four-stage withdrawal UI is reused; email transfer stays disabled',()=>{
  const steps=read('apps/customer-ui/src/components/dashboard/withdraw-funds/withdraw-funds-steps.ts');
  for(const id of ['EnterAmount','RecipientDetails','ConfirmFundsWithdrawal','Status']) assert.match(steps,new RegExp(id));
  assert.match(read('apps/customer-ui/src/routes/dashboard/TransferFunds.tsx'),/aren't available right now/);
  const form=read('apps/customer-ui/src/components/dashboard/withdraw-funds/RecipientDetailForm.tsx');
  assert.match(form,/verificationGeneration/);
  assert.doesNotMatch(form,/fetchBankList|addBankAccount|getSavedAccounts/);
  assert.match(read('apps/customer-ui/src/lib/api/axios.ts'),/"\/transfers\/resolve-account"/);
});

test('C3 bank list uses authenticated TwiPay provider catalogue and validates payload',async()=>{
  const banks=await f.listTransferBanks('paystack');
  assert.equal(banks.length,1);
  assert.equal(banks[0].bankCode,'058');
  assert.equal(calls.at(-1).path,'/transfers/banks');
  assert.equal(calls.at(-1).options.params.provider,'paystack');
  await assert.rejects(()=>f.listTransferBanks('unknown'));
});
test('C3 provider-native listBanks adapters preserve source bank codes and paginate',async()=>{
  const paystack=read('packages/providers/payments/paystack/src/index.ts');
  const monnify=read('packages/providers/payments/monnify/src/index.ts');
  const port=read('packages/contracts/src/index.ts');
  assert.match(port,/listBanks\(\): Promise<BankDirectoryEntry\[\]>/);
  assert.match(paystack,/country:'nigeria',currency:'NGN',perPage:'100',use_cursor:'true'/);
  assert.match(paystack,/PAYSTACK_BANK_DIRECTORY_CURSOR_LOOP/);
  assert.match(paystack,/PAYSTACK_BANK_DIRECTORY_INCOMPLETE/);
  assert.match(monnify,/authorized\('GET','\/api\/v1\/banks'\)/);
  assert.match(read('apps/api/src/modules/finance/presentation/finance.controller.ts'),/@Get\('transfers\/banks'\)/);
  assert.match(read('apps/api/src/modules/finance/application/transfer.service.ts'),/bankDirectoryCache/);
  assert.match(read('apps/customer-ui/src/components/dashboard/withdraw-funds/RecipientDetailForm.tsx'),/listTransferBanks/);
});
test('C3 Paystack adapter consumes provider cursor pages without inventing bank codes',async()=>{
  const source=read('packages/providers/payments/paystack/src/index.ts');
  const code=ts.transpileModule(source,{fileName:'paystack.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const output={};
  vm.runInNewContext(code,{exports:output,require:id=>id==='node:crypto'?require('node:crypto'):{},URL,URLSearchParams,Buffer,Date,Error,BigInt,String,Number,Object,Set,Map,Array,JSON});
  const a=new output.PaystackAdapter({secretKey:'test_demo_adapter_only'});
  const invoked=[];
  a.request=async(_method,path)=>{
    invoked.push(path);
    return invoked.length===1
      ? {data:[{code:'058',name:'Sample Bank',active:true,currency:'NGN'},{code:'000',name:'Closed Bank',active:false}],meta:{next:'cursor-2'}}
      : {data:[{code:'057',name:'Second Bank',active:true,currency:'NGN'}],meta:{next:null}};
  };
  const banks=await a.listBanks();
  assert.equal(banks.length,2);
  assert.equal(banks[0].name,'Sample Bank');
  assert.ok(invoked[1].includes('next=cursor-2'));
  a.request=async()=>({data:null});
  await assert.rejects(()=>a.listBanks(),/DIRECTORY_INVALID/);
});
test('C3 Monnify adapter reads documented OAuth bank-directory envelope and rejects malformed data',async()=>{
  const source=read('packages/providers/payments/monnify/src/index.ts');
  const code=ts.transpileModule(source,{fileName:'monnify.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const output={};
  vm.runInNewContext(code,{exports:output,require:id=>id==='node:crypto'?require('node:crypto'):{},URL,URLSearchParams,Buffer,Date,Error,BigInt,String,Number,Object,Set,Map,Array,JSON});
  const a=new output.MonnifyAdapter({apiKey:'testonly',secretKey:'testonly',contractCode:'testonly'});
  a.authorized=async(method,path)=>{
    assert.equal(method,'GET');assert.equal(path,'/api/v1/banks');
    return {requestSuccessful:true,responseBody:[{code:'044',name:'Access Bank'},{code:'..',name:'Invalid Code'},{code:'058',name:'Example Bank'}]};
  };
  const banks=await a.listBanks();
  assert.equal(banks.length,2);
  assert.equal(banks[0].bankCode,'044');
  a.authorized=async()=>({requestSuccessful:false,responseBody:[]});
  await assert.rejects(()=>a.listBanks(),/DIRECTORY_INVALID/);
});
