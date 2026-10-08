import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {
  billIdentifier,billIsFinal,billIsSuccess,billNairaToMinor,readBillCatalogue,readBillValidation,
  readBillPurchase,readBillPurchases,readBillSubmission,billsSandboxEnabled
} from '../../../apps/customer-ui/src/lib/api/dashboard-apis/billContracts.ts';
const root=resolve(import.meta.dirname,'../../..');
const source=(p)=>readFileSync(resolve(root,p),'utf8');
const product={code:'airtime-vtpass-sku',category:'AIRTIME',name:'MTN Airtime',customerIdentifierType:'PHONE',currency:'NGN',fixedAmountMinor:null,minAmountMinor:'10000',maxAmountMinor:'10000000'};
const sample={reference:'bill-123',status:'PROCESSING',productCode:product.code,category:product.category,productName:product.name,amountMinor:'15000',currency:'NGN',provider:'vtpass'};
test('catalogue accepts only verified category/currency and unique product codes',()=>{
  assert.equal(readBillCatalogue({products:[product]},'AIRTIME')[0].code,product.code);
  assert.throws(()=>readBillCatalogue({products:[{...product,category:'CABLE'}]},'AIRTIME'));
  assert.throws(()=>readBillCatalogue({products:[product,product]},'AIRTIME'));
  assert.throws(()=>readBillCatalogue({products:[{...product,currency:'USD'}]},'AIRTIME'));
  assert.throws(()=>readBillCatalogue({products:[{...product,minAmountMinor:'NaN'}]},'AIRTIME'));
});
test('naira conversion is exact integer kobo, min/max enforced',()=>{
  assert.equal(billNairaToMinor('100.01',product),'10001');
  assert.equal(billNairaToMinor('100000',product),'10000000');
  for(const input of ['-1','0','1e9','NaN','100.001','99.99','100000.01','99999999999999999999','90071992547410']) assert.throws(()=>billNairaToMinor(input,product),input);
});
test('fixed-price products reject different amounts',()=>{
  const fixed={...product,fixedAmountMinor:'15050'};
  assert.equal(billNairaToMinor('150.50',fixed),'15050');
  assert.throws(()=>billNairaToMinor('151',fixed));
});
test('recipient identifiers are validated and controls excluded',()=>{
  assert.equal(billIdentifier(' 08030000000 '),'08030000000');
  assert.throws(()=>billIdentifier('x'));
  assert.throws(()=>billIdentifier('x'.repeat(65)));
  assert.throws(()=>billIdentifier('abc\nxyz'));
});
test('customer validation ID, valid, expiry are verified',()=>{
  const valid={validation:{id:'aaaabbbb-1111-2222-3333-aabbccddeeff',valid:true,customerName:null,providerCode:'vtpass',expiresAt:'2030-10-08T00:00:00.000Z'}};
  assert.equal(readBillValidation(valid).valid,true);
  assert.throws(()=>readBillValidation({validation:{...valid.validation,id:'x'}}));
  assert.throws(()=>readBillValidation({validation:{...valid.validation,expiresAt:'tomorrow'}}));
});
test('unknown provider state cannot become successful',()=>{
  assert.equal(readBillPurchase(sample).status,'PROCESSING');
  assert.equal(readBillPurchase({...sample,status:'UNKNOWN'}).status,'UNKNOWN');
  assert.equal(billIsSuccess('UNKNOWN'),false);
  assert.equal(billIsFinal('UNKNOWN'),false);
  assert.equal(billIsSuccess('SUCCEEDED'),true);
  assert.equal(billIsFinal('REVERSED'),true);
  assert.throws(()=>readBillPurchase({...sample,status:'PAID'}));
  assert.throws(()=>readBillPurchase({...sample,amountMinor:'150.00'}));
});
test('uncertain 202 minimal response retains reference but never invents success or settlement',()=>{
  assert.deepEqual(readBillSubmission({reference:'bill-789',status:'UNKNOWN',code:'PROVIDER_OUTCOME_UNKNOWN'}, {productCode:product.code,amountMinor:'15000'}),{reference:'bill-789',status:'UNKNOWN',code:'PROVIDER_OUTCOME_UNKNOWN'});
  assert.throws(()=>readBillSubmission({reference:'bad/ref',status:'UNKNOWN',code:'PROVIDER_OUTCOME_UNKNOWN'},{productCode:product.code,amountMinor:'15000'}));
  assert.throws(()=>readBillSubmission({...sample,amountMinor:'20000'},{productCode:product.code,amountMinor:'15000'}));
});
test('purchase list uses owner-scoped API responses and rejects forged status',()=>{
  assert.equal(readBillPurchases({purchases:[sample]}).length,1);
  assert.throws(()=>readBillPurchases({purchases:[{...sample,status:'PAID'}]}));
  assert.throws(()=>readBillPurchases({purchases:'not an array'}));
});
test('sandbox function is default-off and never true in production' ,()=>{
  assert.equal(billsSandboxEnabled(undefined),false);
  assert.equal(billsSandboxEnabled('false'),false);
  assert.equal(billsSandboxEnabled('true','production'),false);
  assert.equal(billsSandboxEnabled('true','test'),true);
});
test('four service routes are mapped to the TwiPay bills adapter without old purchase code',()=>{
  for(const [folder,name,category] of [['airtime','Airtime','AIRTIME'],['data','Data','DATA'],['electricity','Electricity','ELECTRICITY'],['tv-cable','TVCable','CABLE']]){
    const src=source(`apps/customer-ui/src/components/dashboard/services/${folder}/${name}.tsx`);
    assert.match(src,new RegExp(`IntegratedBillService category="${category}"`));
    assert.doesNotMatch(src, /(?:buyAirtime|buyData|buyUnit|subscribeToTv|EnterPin)/);
  }
});
test('API requires independent non-production sandbox gate for validation and purchase',()=>{
  const src=source('apps/api/src/modules/services/presentation/services.controller.ts');
  assert.match(src,/BILL_PURCHASES_SANDBOX_ENABLED/);
  assert.match(src,/process\.env\['NODE_ENV'\] === 'production'/);
  assert.match(src,/BILL_PROVIDER_SANDBOX_REQUIRED/);
  assert.match(src,/sandbox\.vtpass\.com/);
  assert.match(src,/sandbox\.monnify\.com/);
  assert.equal((src.match(/this\.assertSandboxPurchasesEnabled\(\)/g)||[]).length,2);
  assert.match(src, /requireIdempotencyKey/);
  assert.match(source('apps/api/src/platform/config/env.ts'),/BILL_PURCHASES_SANDBOX_ENABLED: z\.enum\(\['true', 'false'\]\)\.default\('false'\)/);
});
test('browser requires cookie session and idempotency, and route allowlist is narrow',()=>{
  const b=source('apps/customer-ui/src/lib/api/dashboard-apis/bills.ts');
  assert.match(b,/Idempotency-Key/);
  assert.match(b,/VITE_TWIPAY_BILLS_SANDBOX_ENABLED !== 'true'/);
  assert.match(b,/\/services\/validations/);
  assert.match(b,/\/services\/purchases/);
  const a=source('apps/customer-ui/src/lib/api/axios.ts');
  assert.match(a,/"\/services\/purchases"/);
  assert.match(a,/\/services\\\/purchases/);
  const c=source('apps/customer-ui/src/components/dashboard/services/IntegratedBillService.tsx');
  assert.match(c,/crypto\.randomUUID/);
  assert.match(c,/inFlight\.current/);
  assert.match(c,/writeStoredIntent\(stored\)/);
  assert.match(c,/!billIsFinal\(result\.status\)/);
  assert.match(c,/\/dashboard\/history/);
});
test('server retains hold and provider reconciliation financial invariants',()=>{
  const src=source('apps/api/src/modules/services/application/bill.service.ts');
  for(const fragment of ['reserveWithTx','IdempotencyService','moveToProviderSubmittedWithTx','never automatically routed','deferReconcileAfterQueryFailure','applyProviderResult','reconcileDue','userId: input.userId']) assert.ok(src.includes(fragment),fragment);
});
