import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = new URL('../../../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8');
const apiSource = read('apps/api/src/modules/finance/presentation/finance.controller.ts');
const clientSource = read('apps/customer-ui/src/lib/api/dashboard-apis/txnHistoryApis.ts');
const axiosSource = read('apps/customer-ui/src/lib/api/axios.ts');
const historyView = read('apps/customer-ui/src/routes/dashboard/History.tsx');
const receiptView = read('apps/customer-ui/src/components/receipt/Receipt.tsx');
const raw = { reference:'twp_fund_1234', type:'FUNDING', status:'SUCCEEDED', currency:'NGN',
  amountMinor:'9007199254740993', feeMinor:'0', description:'Wallet funding', provider:'paystack',
  createdAt:'2026-10-08T13:00:00.000Z', updatedAt:'2026-10-08T13:00:01.000Z'};
const calls=[];
let returned={transactions:[raw],pagination:{total:1,page:1,limit:50,totalPages:1,hasNext:false,hasPrev:false}};
function transpile(source, fileName) { return ts.transpileModule(source,{fileName,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText; }
const money={exports:{}};
vm.runInNewContext(transpile(read('apps/customer-ui/src/lib/money.ts'),'money.ts'),{exports:money.exports,require});
const obj={exports:{}};
vm.runInNewContext(transpile(clientSource,'txnHistoryApis.ts'),{
  exports:obj.exports,BigInt,Date,TypeError,Error,Number,RegExp,Object,String,
  require(name){
    if(name==='../axios') return {__esModule:true,default:{get:async(...args)=>{calls.push(args);return {data:returned};}}};
    if(name==='@/lib/money') return money.exports;
    throw new Error('Unexpected dependency '+name);
  }
});
const client=obj.exports;
test('C1 preserves unrounded kobo values and their exact displayed amounts',()=>{
  const v=client.adaptTransaction(raw);
  assert.equal(v.amountMinor,'9007199254740993');
  assert.equal(v.amount,'90071992547409.93');
  assert.equal(client.formatTransactionAmount(v),'₦90,071,992,547,409.93');
  assert.equal(v.status,'success');
});
test('UNKNOWN, pending, failed and reversed are never presented as succeeded',()=>{
  for (const [state,expected] of [['UNKNOWN','unknown'],['CREATED','pending'],['PROVIDER_SUBMITTED','processing'],['FAILED','failed'],['REVERSED','reversed']]){
    assert.equal(client.adaptTransaction({...raw,status:state}).status,expected);
  }
});
test('malformed amount, unsupported currency and missing references fail closed',()=>{
  for (const delta of [{amountMinor:'12.25'},{amountMinor:'NaN'},{currency:'USD'},{reference:'../admin'},{status:'PAID'}]){
    assert.throws(()=>client.adaptTransaction({...raw,...delta}));
  }
});
test('raw backend account number is already masked, and not fabricated',()=>{
  const v=client.adaptTransaction({...raw,type:'TRANSFER',beneficiary:{bankCode:'123',accountNumber:'******4321',accountName:'Test'}});
  assert.equal(v.metadata.accountNumber,'******4321');
  assert.equal(v.direction,'DEBIT');
  assert.equal(v.metadata.bankName,undefined);
});
test('naira range filtering converts accurately, rejects fractions exceeding two decimals',()=>{
  assert.equal(client.amountFilterToMinor('90071992547409.93'),'9007199254740993');
  for(const val of ['-1','2.001','Infinity','1e3','1,000','']) assert.throws(()=>client.amountFilterToMinor(val));
});
test('history request sends validated filters to TwiPay GET /transactions',async()=>{
  await client.getTxnHistory({page:1,per_page:50,status:'successful',type:'wallet_funding',startPrice:'0.25'});
  assert.equal(calls.at(-1)[0],'/transactions');
  assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1)[1].params)),{page:1,limit:50,status:'SUCCEEDED',type:'FUNDING',minAmountMinor:'25'});
  await client.getTxnHistory({per_page:100,status:'pending'});
  assert.equal(calls.at(-1)[1].params.status,'PENDING');
  await assert.rejects(client.getTxnHistory({page:1,per_page:101}),/Invalid page/);
  await assert.rejects(client.getTxnHistory({page:1,per_page:10,status:'betting'}),/Unsupported/);
});
test('detail response is owner-scoped by backend and rejects missing reference',async()=>{
  returned={transaction:{...raw,reference:'twp_fund_test-42'}};
  const detail=await client.getTxnHistoryDetail({queryKey:['transaction-details','twp_fund_test-42']});
  assert.equal(detail.reference,'twp_fund_test-42');
  assert.equal(calls.at(-1)[0],'/transactions/twp_fund_test-42');
  returned={transaction:null};
  await assert.rejects(client.getTxnHistoryDetail({queryKey:['transaction-details','missing']}),/not found/);
  await assert.rejects(client.getTxnHistoryDetail({queryKey:['transaction-details','../admin']}),/Invalid/);
});
test('API query is bounded and enforces session-principal user ownership',()=>{
  assert.match(apiSource,/@UseGuards\(SessionAuthGuard\)/);
  assert.match(apiSource,/userId: principal\.userId/);
  assert.match(apiSource,/limit: z\.coerce\.number\(\)\.int\(\)\.min\(1\)\.max\(100\)/);
  assert.match(apiSource,/skip: \(query\.page - 1\) \* query\.limit/);
  assert.match(apiSource,/financialTransaction\.count\(\{ where \}\)/);
  assert.match(apiSource,/where: \{ reference, userId: principal\.userId \}/);
  assert.match(apiSource,/description: transaction\.description/);
  assert.doesNotMatch(apiSource,/req\.query\.userId/);
});
test('only intended owner-authenticated transaction routes are enabled in client',()=>{
  assert.match(axiosSource,/path === "\/transactions"/);
  assert.match(axiosSource,/\^\\\/transactions/);
  assert.doesNotMatch(axiosSource,/\/wallet\/transactions/);
});
test('preserved history and receipt screens surface network and incomplete statuses',()=>{
  assert.match(historyView,/hasHistoryError/);
  assert.match(receiptView,/Not proof of successful payment/);
  assert.match(read('apps/customer-ui/src/components/dashboard/history/TxnDetailDesktop.tsx'),/disabled=\{!txnDetails \|\| txnDetails\.status !== "success"\}/);
});
test('permitted filter options exclude betting and travel products',()=>{
  const filters=read('apps/customer-ui/src/components/dashboard/history/ApplyFilters.tsx');
  const list=filters.match(/const services = \[([^\]]+)\]/)?.[1]??'';
  assert.doesNotMatch(list,/betting|flight|internationalAirtime|internationalData/);
  assert.match(list,/wallet_transfer/);
});
