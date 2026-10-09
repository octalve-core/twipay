/** Batch 4.5 executable signed-utility-quote tests. No provider, DB or browser claim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = resolve(import.meta.dirname, '../../..');
const source = path => readFileSync(resolve(root,path),'utf8');
class ApiError extends Error { constructor(payload){super(payload.code);this.code=payload.code;} }
const path='apps/api/src/modules/services/application/bill-quote.ts';
const compiled=ts.transpileModule(source(path),{fileName:path,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const mod={exports:{}};
new Function('require','module','exports',compiled)(id=>{
  if(id==='node:crypto')return require(id);
  if(id==='@nestjs/common')return {ForbiddenException:ApiError,ServiceUnavailableException:ApiError};
  throw Error(`Unexpected import ${id}`);
},mod,mod.exports);
const {issueBillQuote,verifyBillQuote,billPricingDigest}=mod.exports;
const environmentKeys=['NODE_ENV','BILL_QUOTE_HMAC_KEY','BILL_FEE_POLICY_SANDBOX_APPROVED','BILL_CUSTOMER_FEE_MINOR'];
const original=Object.fromEntries(environmentKeys.map(k=>[k,process.env[k]]));
Object.assign(process.env,{NODE_ENV:'test',BILL_QUOTE_HMAC_KEY:'ef'.repeat(32),BILL_FEE_POLICY_SANDBOX_APPROVED:'true',BILL_CUSTOMER_FEE_MINOR:'0'});
process.on('exit',()=>{for(const [key,v]of Object.entries(original))if(v===undefined)delete process.env[key];else process.env[key]=v;});
const pricing={fixedAmountMinor:20000n,minAmountMinor:null,maxAmountMinor:null,currency:'NGN',status:'ACTIVE',category:'DATA',name:'Data package',customerIdentifierType:'PHONE'};
const input={userId:'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',productCode:'data-test',productId:'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
  offerId:'cccccccc-cccc-4ccc-cccc-cccccccccccc',identifierFingerprint:'a'.repeat(64),validationId:'dddddddd-dddd-4ddd-dddd-dddddddddddd',
  pricingDigest:billPricingDigest(pricing),amountMinor:20000n};
const issued=()=>issueBillQuote(input);
test('only explicit sandbox-approved zero fee yields a signed exact total',()=>{
  const {terms,token}=issued();assert.equal(terms.amountMinor,'20000');assert.equal(terms.feeMinor,'0');assert.equal(terms.totalDebitMinor,'20000');
  assert.equal(verifyBillQuote({...input,token}).id,terms.id);
  assert.equal(token.includes(input.userId),false);assert.equal(token.includes('customer identifier'),false);
});
test('unapproved, missing, production and positive customer fee policies fail closed',()=>{
  for(const [key,value] of [['BILL_FEE_POLICY_SANDBOX_APPROVED','false'],['BILL_CUSTOMER_FEE_MINOR','1'],['BILL_CUSTOMER_FEE_MINOR',undefined],['NODE_ENV','production']]){
    const old=process.env[key];if(value===undefined)delete process.env[key];else process.env[key]=value;
    try{assert.throws(issued,{code:'BILL_PRICING_POLICY_NOT_APPROVED'});}finally{if(old===undefined)delete process.env[key];else process.env[key]=old;}
  }
});
test('missing, weak or reused signing secrets fail closed',()=>{
  for(const value of [undefined,'01','a'.repeat(64)]){
    const old=process.env.BILL_QUOTE_HMAC_KEY;
    if(value===undefined)delete process.env.BILL_QUOTE_HMAC_KEY;else process.env.BILL_QUOTE_HMAC_KEY=value;
    try{assert.throws(issued,{code:'BILL_PRICING_POLICY_NOT_APPROVED'});}finally{process.env.BILL_QUOTE_HMAC_KEY=old;}
  }
  process.env.TRANSFER_QUOTE_HMAC_KEY='ef'.repeat(32);
  try{assert.throws(issued,{code:'BILL_PRICING_POLICY_NOT_APPROVED'});}finally{delete process.env.TRANSFER_QUOTE_HMAC_KEY;}
});
test('signature tampering is rejected',()=>{
  const {token}=issued();const [payload,signature]=token.split('.');
  assert.throws(()=>verifyBillQuote({...input,token:payload+'A.'+signature}),{code:'BILL_QUOTE_INVALID_EXPIRED_OR_CHANGED'});
  assert.throws(()=>verifyBillQuote({...input,token:payload+'.'+'A'.repeat(signature.length)}),{code:'BILL_QUOTE_INVALID_EXPIRED_OR_CHANGED'});
});
test('owner, product, offer, validation, identifier, pricing and amount changes fail',()=>{
  const {token}=issued();for(const changed of [{userId:'other'},{productCode:'different'},{productId:'different'},
    {offerId:'different'},{validationId:'different'},{identifierFingerprint:'b'.repeat(64)},
    {pricingDigest:'c'.repeat(64)},{amountMinor:20001n}]) {
    assert.throws(()=>verifyBillQuote({...input,...changed,token}),{code:'BILL_QUOTE_INVALID_EXPIRED_OR_CHANGED'});
  }
});
test('product names, category and identifier type are part of the immutable price snapshot',()=>{
  for(const change of [{name:'Another data pack'},{category:'AIRTIME'},{customerIdentifierType:'METER'},{fixedAmountMinor:25000n}]) {
    assert.notEqual(billPricingDigest({...pricing,...change}),input.pricingDigest);
  }
});
test('expired or forged future quote is rejected even with a valid HMAC',()=>{
  const {token}=issued();
  for(const expiresAt of [Date.now()-1000,Date.now()+6*60_000]) {
    const q=JSON.parse(Buffer.from(token.split('.')[0],'base64url').toString('utf8'));q.expiresAt=expiresAt;
    const payload=Buffer.from(JSON.stringify(q)).toString('base64url');
    const signature=require('node:crypto').createHmac('sha256',Buffer.from(process.env.BILL_QUOTE_HMAC_KEY,'hex')).update(payload).digest('base64url');
    assert.throws(()=>verifyBillQuote({...input,token:`${payload}.${signature}`}),{code:'BILL_QUOTE_INVALID_EXPIRED_OR_CHANGED'});
  }
});
test('monetary maximum is enforced without floating point',()=>{
  assert.throws(()=>issueBillQuote({...input,amountMinor:BigInt(Number.MAX_SAFE_INTEGER)+1n}),{code:'BILL_PRICING_POLICY_NOT_APPROVED'});
  assert.throws(()=>issueBillQuote({...input,amountMinor:0n}),{code:'BILL_PRICING_POLICY_NOT_APPROVED'});
});
test('single-use quote enforced by unique UUID column and transaction-level repricing',()=>{
  const schema=source('packages/database/prisma/schema.prisma');const migration=source('packages/database/prisma/migrations/0014_bill_purchase_signed_quotes/migration.sql');
  const service=source('apps/api/src/modules/services/application/bill.service.ts');
  assert.match(schema,/approvalQuoteId\s+String\?\s+@unique\s+@db\.Uuid/);
  assert.match(migration,/CREATE UNIQUE INDEX "bill_purchases_approvalQuoteId_key"/);
  assert.match(migration,/approval quote is immutable/);
  assert.match(service,/approvalQuoteId: quote\.id/);
  assert.match(service,/verifyBillQuote\(\{ token: input\.quoteToken/);
  assert.match(service,/await this\.authorization\.assertCurrentWithTx\(tx, input\.authorization/);
});
test('UI must bind quote, PIN and idempotency without keeping PIN in session storage',()=>{
  const ui=source('apps/customer-ui/src/components/dashboard/services/IntegratedBillService.tsx');
  const api=source('apps/customer-ui/src/lib/api/dashboard-apis/bills.ts');const controller=source('apps/api/src/modules/services/presentation/services.controller.ts');
  assert.match(ui,/type="password"/);assert.match(ui,/quoteToken:review\.quote\.quoteToken,transactionPin:pin/);
  assert.match(ui,/setPin\(''\)/);assert.match(ui,/feeMinor/);assert.match(ui,/totalDebitMinor/);
  assert.doesNotMatch(ui,/writeStoredIntent\(\{[^}]*pin/);
  assert.match(api,/\/services\/quotes/);assert.match(controller,/intent: 'BILL_PAYMENT'/);
  assert.match(controller,/amountMinor: totalDebit/);
});

// Exercise real BillService methods, with isolated Prisma/router seams. This is
// intentionally not a real PostgreSQL concurrency or provider-delivery test.
const servicePath='apps/api/src/modules/services/application/bill.service.ts';
const serviceJs=ts.transpileModule(source(servicePath),{fileName:servicePath,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
const serviceExports={exports:{}};
const sha256=v=>require('node:crypto').createHash('sha256').update(v).digest('hex');
new Function('require','module','exports',serviceJs)(id=>{
  if(id==='@nestjs/common')return {Injectable:()=>v=>v,BadRequestException:ApiError,ConflictException:ApiError,NotFoundException:ApiError};
  if(id==='@twipay/services')return {assertBillAmount:({amountMinor,fixedAmountMinor,minAmountMinor,maxAmountMinor})=>{
    if(amountMinor<=0n || (fixedAmountMinor!==undefined && amountMinor!==fixedAmountMinor)
      || (minAmountMinor!==undefined && amountMinor<minAmountMinor)
      || (maxAmountMinor!==undefined && amountMinor>maxAmountMinor))throw new ApiError({code:'INVALID_BILL_AMOUNT'});
  },assertBillPurchaseTransition:()=>{}};
  if(id==='@twipay/security')return {fingerprintSensitiveValue:v=>sha256(v),encryptSensitiveString:v=>v,decryptSensitiveString:v=>v};
  if(id==='./bill-quote.js')return {billPricingDigest,issueBillQuote,verifyBillQuote};
  if(id==='./reference.js')return {createFinancialReference:()=> 'bill:test'};
  if(id.startsWith('./')||id.startsWith('../')||id.startsWith('../../../'))return {};
  throw Error('Unexpected service import '+id);
},serviceExports,serviceExports.exports);
const product={id:input.productId,code:input.productCode,category:'DATA',name:'Data package',customerIdentifierType:'PHONE',currency:'NGN',status:'ACTIVE',fixedAmountMinor:20000n,minAmountMinor:null,maxAmountMinor:null};
const verification={id:input.validationId,userId:input.userId,providerOfferId:input.offerId,
  customerIdentifierFingerprint:sha256('+2348011111111'),valid:true,providerCode:'vtpass',expiresAt:new Date(Date.now()+10*60_000)};
function serviceWithSeams({productRow=product,validationRow=verification,offerId=input.offerId}={}) {
  const observed=[];
  const db={billProduct:{findUnique:async query=>{observed.push(query);return productRow;}},
    billCustomerValidation:{findFirst:async query=>{observed.push(query);return validationRow && validationRow.userId===query.where.userId && validationRow.valid===true && validationRow.expiresAt>query.where.expiresAt.gt && validationRow.providerOfferId===query.where.providerOfferId ? validationRow : null;}}};
  const router={resolve:async()=>({offerId,providerCode:'vtpass'})};
  return {service:new serviceExports.exports.BillService(db,{}, {},router,{},{},{},{}),observed};
}
test('actual quote service requires owner-scoped valid customer evidence from selected offer',async()=>{
  const {service,observed}=serviceWithSeams();
  const quote=await service.quotePurchase({userId:input.userId,productCode:input.productCode,
    customerIdentifier:'+2348011111111',amountMinor:20000n,validationId:input.validationId});
  assert.equal(quote.amountMinor,'20000');assert.equal(quote.totalDebitMinor,'20000');
  assert.equal(observed[1].where.userId,input.userId);
  assert.equal(observed[1].where.providerOfferId,input.offerId);
  assert.equal(verifyBillQuote({...input,identifierFingerprint:sha256('+2348011111111'),token:quote.quoteToken}).offerId,input.offerId);
});
test('actual quote service refuses missing, other-owner or expired validation evidence',async()=>{
  for(const evidence of [null,{...verification,userId:'other'},{...verification,valid:false},{...verification,expiresAt:new Date(Date.now()-1000)}]){
    const {service}=serviceWithSeams({validationRow:evidence});
    await assert.rejects(()=>service.quotePurchase({userId:input.userId,productCode:input.productCode,
      customerIdentifier:'+2348011111111',amountMinor:20000n,validationId:input.validationId}),
      evidence===null?{code:'BILL_VALIDATION_EXPIRED_RESTART'}:undefined);
  }
});
test('actual total-debit verification refuses changed route and price before PIN authorization',async()=>{
  const validService=serviceWithSeams().service;
  const quote=await validService.quotePurchase({userId:input.userId,productCode:input.productCode,
    customerIdentifier:'+2348011111111',amountMinor:20000n,validationId:input.validationId});
  const request={userId:input.userId,token:quote.quoteToken,productCode:input.productCode,
    customerIdentifier:'+2348011111111',validationId:input.validationId,amountMinor:20000n};
  assert.equal(await validService.totalDebitForQuote(request),20000n);
  await assert.rejects(()=>serviceWithSeams({offerId:'another-offer'}).service.totalDebitForQuote(request),{code:'BILL_QUOTE_INVALID_EXPIRED_OR_CHANGED'});
  await assert.rejects(()=>serviceWithSeams({productRow:{...product,fixedAmountMinor:25000n}}).service.totalDebitForQuote(request),{code:'BILL_QUOTE_INVALID_EXPIRED_OR_CHANGED'});
});
test('actual reconciliation service refuses misassigned provider evidence without touching terminal ledger',async()=>{
  const cases=[];let ledgerOperations=0;
  const transaction={
    $queryRaw:async()=>[],
    financialTransaction:{findUniqueOrThrow:async()=>({id:'finance-1',reference:'bill-test',status:'SUCCEEDED',amountMinor:20000n,currency:'NGN'})},
    billPurchase:{findUniqueOrThrow:async()=>({id:'purchase-1',userId:input.userId,financialTransactionId:'finance-1',providerOfferId:input.offerId,status:'SUCCEEDED'})},
    providerOperation:{findUniqueOrThrow:async()=>({id:'operation-1',financialTransactionId:'finance-1',userId:input.userId,
      providerCode:'monnify',type:'BILL_PURCHASE',merchantReference:'bill-test'})},
    billProviderOffer:{findUniqueOrThrow:async()=>({id:input.offerId,providerCode:'vtpass'})},
    reconciliationCase:{findFirst:async()=>null,create:async ({data})=>{cases.push(data);return data;}},
  };
  const prisma={$transaction:async callback=>callback(transaction)};
  const s=new serviceExports.exports.BillService(prisma,{}, {},{},{},{}, {},{postWithTx:async()=>{ledgerOperations++;}});
  const result=await s.applyProviderResult({purchaseId:'purchase-1',financialTransactionId:'finance-1',providerOperationId:'operation-1',holdId:'hold-1',
    walletLedgerAccountId:'wallet-1',providerCode:'vtpass',category:'DATA',result:{status:'SUCCEEDED',amountMinor:20000n,currency:'NGN'}});
  assert.equal(result,'UNKNOWN');assert.equal(cases.length,1);assert.equal(cases[0].status,'NEEDS_REVIEW');
  assert.equal(ledgerOperations,0);
});
