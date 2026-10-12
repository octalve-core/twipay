/** Phase 4.3 executable isolated tests. PostgreSQL, provider and browser qualification remain open. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const root=resolve(import.meta.dirname,'../../..');
const source=(path)=>readFileSync(resolve(root,path),'utf8');
class ApiError extends Error { constructor(payload){super(payload.code);this.code=payload.code;} }
const env={...process.env};
process.env.NODE_ENV='test';
process.env.TRANSFER_FEE_SANDBOX_APPROVED='true';
process.env.TRANSFER_FEE_PAYSTACK_MINOR='150';
process.env.TRANSFER_FEE_MONNIFY_MINOR='0';
process.env.TRANSFER_QUOTE_HMAC_KEY='a9'.repeat(32);
process.env.PII_FINGERPRINT_KEY='fingerprint-test';
process.env.DATA_ENCRYPTION_KEY='encryption-test';
process.on('exit',()=>{for(const k of ['NODE_ENV','TRANSFER_FEE_SANDBOX_APPROVED','TRANSFER_FEE_PAYSTACK_MINOR','TRANSFER_FEE_MONNIFY_MINOR','TRANSFER_QUOTE_HMAC_KEY','PII_FINGERPRINT_KEY','DATA_ENCRYPTION_KEY']){
  if(env[k]===undefined)delete process.env[k];else process.env[k]=env[k];
}});
function transpile(path){return ts.transpileModule(source(path),{fileName:path,compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;}
const quoted={exports:{}};
new Function('require','module','exports',transpile('apps/api/src/modules/finance/application/transfer-quote.ts'))(
  (id)=>{if(id==='node:crypto')return require(id);if(id==='@nestjs/common')return {ForbiddenException:ApiError,ServiceUnavailableException:ApiError};throw Error('Unexpected quote import '+id);},quoted,quoted.exports);
const {issueTransferQuote,verifyTransferQuote}=quoted.exports;
const quoteInput={userId:'129f5667-d723-4d0c-a8cb-36a3edc302c5',provider:'paystack',bankCode:'057',
  accountFingerprint:'d'.repeat(64),accountName:'Verified Customer',narration:'Approved family transfer',amountMinor:25000n};
test('saved-recipient quote cannot be spent as a manual quote or for a different saved record',()=>{
  const beneficiary='a5e5f162-65bd-452e-98b1-d0252deea7c4';
  const {token}=issueTransferQuote({...quoteInput,savedBeneficiaryId:beneficiary});
  assert.equal(verifyTransferQuote({...quoteInput,savedBeneficiaryId:beneficiary,token}).savedBeneficiaryId,beneficiary);
  assert.throws(()=>verifyTransferQuote({...quoteInput,token}),{code:'TRANSFER_QUOTE_EXPIRED_OR_CHANGED'});
  assert.throws(()=>verifyTransferQuote({...quoteInput,savedBeneficiaryId:'b5e5f162-65bd-452e-98b1-d0252deea7c4',token}),{code:'TRANSFER_QUOTE_EXPIRED_OR_CHANGED'});
  assert.throws(()=>verifyTransferQuote({...quoteInput,userId:'another-user',savedBeneficiaryId:beneficiary,token}),{code:'TRANSFER_QUOTE_EXPIRED_OR_CHANGED'});
});
test('manual quote cannot be spent through the saved-recipient endpoint',()=>{
  const {token}=issueTransferQuote(quoteInput);
  assert.equal(verifyTransferQuote({...quoteInput,token}).savedBeneficiaryId,undefined);
  assert.throws(()=>verifyTransferQuote({...quoteInput,token,savedBeneficiaryId:'a5e5f162-65bd-452e-98b1-d0252deea7c4'}),{code:'TRANSFER_QUOTE_EXPIRED_OR_CHANGED'});
});
const cryptoMock={
  encryptSensitiveString:(value)=>`cipher:${value}`,
  decryptSensitiveString:(value)=>{if(!value.startsWith('cipher:'))throw Error('bad ciphertext');return value.slice(7)},
  fingerprintSensitiveValue:(value)=>`hash:${value}`,
};
function service(db,provider){
  const mod={exports:{}};
  new Function('require','module','exports',transpile('apps/api/src/modules/finance/application/transfer.service.ts'))(
    (id)=>{
      if(id==='@nestjs/common')return {ConflictException:ApiError,ForbiddenException:ApiError,NotFoundException:ApiError,Injectable:()=>x=>x};
      if(id==='@twipay/security')return cryptoMock;
      if(id==='@twipay/ledger')return {LedgerInvariantError:class extends Error {}};
      if(id==='./transfer-quote.js')return {issueTransferQuote,verifyTransferQuote};
      if(id==='./reference.js')return {createFinancialReference:()=> 'xfer:test'};
      throw Error('Unexpected service import '+id);
    },mod,mod.exports);
  return new mod.exports.TransferService(db,{}, {get:()=>provider},{},{},{},{});
}
const valid={id:'a5e5f162-65bd-452e-98b1-d0252deea7c4',userId:quoteInput.userId,saved:true,archivedAt:null,
  providerCode:'paystack',bankCode:'057',accountNumberCiphertext:'cipher:0123456789',
  accountNumberFingerprint:'hash:0123456789',accountNumberLast4:'6789',accountName:'Verified Customer',currency:'NGN'};
test('saved destination always uses the caller ID, active status and provider provenance',async()=>{
  let where;
  const s=service({beneficiary:{findFirst:async arg=>{where=arg.where;return valid;}}});
  assert.deepEqual(await s.savedTransferDestination(quoteInput.userId,valid.id),{
    providerCode:'paystack',bankCode:'057',accountNumber:'0123456789',accountName:'Verified Customer'});
  assert.deepEqual(where,{id:valid.id,userId:quoteInput.userId,saved:true,archivedAt:null,currency:'NGN',providerCode:{in:['paystack','monnify']}});
});
test('missing, archived, other-owner and legacy provenance records are unavailable',async()=>{
  for(const record of [null,undefined,{...valid,providerCode:null}]) {
    const s=service({beneficiary:{findFirst:async()=>record}});
    await assert.rejects(()=>s.savedTransferDestination(quoteInput.userId,valid.id),{code:'SAVED_RECIPIENT_UNAVAILABLE'});
  }
});
test('saved destination rejects incorrect encrypted account, last four and fingerprint',async()=>{
  for (const altered of [
    {...valid,accountNumberCiphertext:'cipher:invalid'},
    {...valid,accountNumberLast4:'9999'},
    {...valid,accountNumberFingerprint:'hash:wrong'},
  ]) {
    const s=service({beneficiary:{findFirst:async()=>altered}});
    await assert.rejects(()=>s.savedTransferDestination(quoteInput.userId,valid.id),{code:'SAVED_RECIPIENT_INTEGRITY_FAILED'});
  }
});
test('saved quotation performs new provider resolution without returning full account details',async()=>{
  const s=service({beneficiary:{findFirst:async()=>valid}}, {
    resolveBankAccount:async()=>({providerCode:'paystack',bankCode:'057',accountNumber:'0123456789',
      accountName:'Verified Customer',currency:'NGN',bankName:'Test Bank'}),
  });
  const quoted=await s.quoteSavedTransfer({userId:quoteInput.userId,savedBeneficiaryId:valid.id,
    amountMinor:25000n,narration:'Approved family transfer'});
  assert.equal(quoted.accountNumberMasked,'******6789');
  assert.equal(quoted.amountMinor,'25000');
  assert.equal(quoted.totalDebitMinor,'25150');
  assert.equal(quoted.accountNumber,undefined);
  assert.equal(quoted.quoteToken.includes('0123456789'),false);
});
test('quote rejects provider account mismatches before issuing terms',async()=>{
  const s=service({beneficiary:{findFirst:async()=>valid}}, {
    resolveBankAccount:async()=>({providerCode:'paystack',bankCode:'057',accountNumber:'9999999999',
      accountName:'Verified Customer',currency:'NGN'}),
  });
  await assert.rejects(()=>s.quoteSavedTransfer({userId:quoteInput.userId,savedBeneficiaryId:valid.id,
    amountMinor:25000n,narration:'Approved family transfer'}),{code:'BENEFICIARY_VERIFICATION_MISMATCH'});
});
test('saved recipient must be rechecked under row lock inside the debit transaction before hold',()=>{
  const s=source('apps/api/src/modules/finance/application/transfer.service.ts');
  assert.match(s,/SELECT "id" FROM "beneficiaries"[\s\S]*FOR UPDATE/);
  assert.match(s,/if \(locked\.length !== 1\) throw new ForbiddenException/);
  const gate=s.indexOf('if (input.savedBeneficiaryId) {',s.indexOf('prepared = await this.prisma.$transaction'));
  const auth=s.indexOf('await this.authorization.assertCurrentWithTx',s.indexOf('prepared = await this.prisma.$transaction'));
  const reserve=s.indexOf('reserveWithTx',gate);
  assert.ok(gate>0&&auth>0&&auth<gate&&reserve>gate);
});
test('legacy beneficiaries are not given guessed providers during migration',()=>{
  const m=source('packages/database/prisma/migrations/0013_saved_beneficiary_provider_provenance/migration.sql');
  assert.match(m,/ADD COLUMN "providerCode" VARCHAR\(40\)/);
  assert.doesNotMatch(m,/UPDATE\s+"beneficiaries"/);
});
test('masked recipient UI, short-lived quote, PIN, server status and no automatic resubmission',()=>{
  const route=source('apps/api/src/modules/finance/presentation/finance.controller.ts');
  assert.match(route,/@Post\('transfers\/beneficiaries\/:id\/quote'\)/);
  assert.match(route,/@Post\('transfers\/beneficiaries\/:id\/transfer'\)/);
  assert.match(route,/transactionPin: body.transactionPin, amountMinor: totalDebitMinor, intent: 'TRANSFER'/);
  const api=source('apps/customer-ui/src/lib/api/dashboard-apis/transfers.ts');
  assert.match(api,/initiateSavedBankTransfer/);
  assert.match(api,/getConfirmedTransferStatus/);
  assert.match(api,/Saved-recipient details changed/);
  const confirm=source('apps/customer-ui/src/components/dashboard/withdraw-funds/ConfirmFundsWithdrawal.tsx');
  assert.match(confirm,/initiateSavedBankTransfer/);
  assert.match(confirm,/quote\.feeMinor/);
  const status=source('apps/customer-ui/src/components/dashboard/withdraw-funds/Status.tsx');
  assert.match(status,/Refresh transfer status/);
  assert.doesNotMatch(status,/initiateBankTransfer/);
});
test('unknown outcome retains hold and returns exactly quoted terms for safe pending status',()=>{
  const s=source('apps/api/src/modules/finance/application/transfer.service.ts');
  assert.match(s,/status: 'UNKNOWN', code: 'PROVIDER_OUTCOME_UNKNOWN',[\s\S]*?feeMinor: quote\.feeMinor, totalDebitMinor: quote\.totalDebitMinor/);
  assert.match(s,/wallet hold intentionally retained/);
});
