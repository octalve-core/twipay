/** Phase 4.2: execute actual transfer-quote TypeScript with a mocked Nest exception seam.
 * Does NOT prove provider fees, PostgreSQL, actual encrypted recipient storage or browser E2E. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const root=resolve(import.meta.dirname,'../../..');
const rel='apps/api/src/modules/finance/application/transfer-quote.ts';
const compiled=ts.transpileModule(readFileSync(resolve(root,rel),'utf8'),{fileName:rel,
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
class ApiError extends Error{constructor(payload){super(payload.code);this.code=payload.code;}}
const mod={exports:{}};
new Function('require','module','exports',compiled)((id)=>{
  if(id==='node:crypto')return require(id);
  if(id==='@nestjs/common')return {ForbiddenException:ApiError,ServiceUnavailableException:ApiError};
  throw Error(`Unexpected import ${id}`);
},mod,mod.exports);
const {approvedFee,issueTransferQuote,verifyTransferQuote}=mod.exports;
const old={NODE_ENV:process.env.NODE_ENV,TRANSFER_FEE_SANDBOX_APPROVED:process.env.TRANSFER_FEE_SANDBOX_APPROVED,
  TRANSFER_FEE_PAYSTACK_MINOR:process.env.TRANSFER_FEE_PAYSTACK_MINOR,TRANSFER_FEE_MONNIFY_MINOR:process.env.TRANSFER_FEE_MONNIFY_MINOR,
  TRANSFER_QUOTE_HMAC_KEY:process.env.TRANSFER_QUOTE_HMAC_KEY};
process.env.NODE_ENV='test';
process.env.TRANSFER_FEE_SANDBOX_APPROVED='true';
process.env.TRANSFER_FEE_PAYSTACK_MINOR='150';
process.env.TRANSFER_FEE_MONNIFY_MINOR='0';
process.env.TRANSFER_QUOTE_HMAC_KEY='a9'.repeat(32);
process.on('exit',()=>{for(const [key,v]of Object.entries(old))if(v===undefined)delete process.env[key];else process.env[key]=v;});
const input={userId:'1bda2020-3c5c-409d-918a-d4b767000001',provider:'paystack',bankCode:'057',
  accountFingerprint:'b'.repeat(64),accountName:'Amina Musa',narration:'Family support',amountMinor:30000n};
function issued(){return issueTransferQuote(input)}
test('explicit approved sandbox configuration produces exact positive fee and total',()=>{
 const {terms,token}=issued();assert.equal(terms.feeMinor,'150');assert.equal(terms.amountMinor,'30000');assert.equal(terms.totalDebitMinor,'30150');
 assert.equal(verifyTransferQuote({...input,token}).id,terms.id);
 assert.equal(token.includes(input.accountName),false);
});
test('fee policy absent, unsupported or production environment rejects quotes',()=>{
 process.env.TRANSFER_FEE_SANDBOX_APPROVED='false';try{assert.throws(issued,{code:'TRANSFER_FEE_POLICY_NOT_APPROVED'});}finally{process.env.TRANSFER_FEE_SANDBOX_APPROVED='true';}
 process.env.NODE_ENV='production';try{assert.throws(issued,{code:'TRANSFER_FEE_POLICY_NOT_APPROVED'});}finally{process.env.NODE_ENV='test';}
 delete process.env.TRANSFER_FEE_PAYSTACK_MINOR;try{assert.throws(issued,{code:'TRANSFER_FEE_POLICY_NOT_APPROVED'});}finally{process.env.TRANSFER_FEE_PAYSTACK_MINOR='150';}
});
test('zero fee is allowed only when explicitly configured',()=>{
 assert.equal(approvedFee('monnify'),0n);
});
test('tampering with signed payload or signature is rejected',()=>{
 const {token}=issued();const parts=token.split('.');
 assert.throws(()=>verifyTransferQuote({...input,token:`${parts[0]}A.${parts[1]}`}),{code:'TRANSFER_QUOTE_INVALID'});
 assert.throws(()=>verifyTransferQuote({...input,token:`${parts[0]}.${'z'.repeat(parts[1].length)}`}),{code:'TRANSFER_QUOTE_INVALID'});
});
test('wrong owner, beneficiary, account fingerprint, narration and amount all fail',()=>{
 const {token}=issued();for(const patch of [{userId:'other'},{bankCode:'044'},{accountFingerprint:'c'.repeat(64)},
  {accountName:'Different name'},{narration:'Different note'},{amountMinor:30001n},{provider:'monnify'}]) {
  assert.throws(()=>verifyTransferQuote({...input,...patch,token}),{code:'TRANSFER_QUOTE_EXPIRED_OR_CHANGED'});
 }
});
test('fee change invalidates an otherwise valid signed quote',()=>{
 const {token}=issued();process.env.TRANSFER_FEE_PAYSTACK_MINOR='151';
 try{assert.throws(()=>verifyTransferQuote({...input,token}),{code:'TRANSFER_FEE_CHANGED_REQUEST_NEW_QUOTE'});}
 finally{process.env.TRANSFER_FEE_PAYSTACK_MINOR='150';}
});
test('expired quote is rejected without accepting the previous financial intent',()=>{
 const {token}=issued();const parts=token.split('.');
 const t=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));t.expiresAt=Date.now()-100;
 const payload=Buffer.from(JSON.stringify(t)).toString('base64url');
 const signature=require('node:crypto').createHmac('sha256',Buffer.from(process.env.TRANSFER_QUOTE_HMAC_KEY,'hex')).update(payload).digest('base64url');
 assert.throws(()=>verifyTransferQuote({...input,token:`${payload}.${signature}`}),{code:'TRANSFER_QUOTE_EXPIRED_OR_CHANGED'});
});
test('fee and total cannot exceed the maximum supported safe amount',()=>{
 assert.throws(()=>issueTransferQuote({...input,amountMinor:BigInt(Number.MAX_SAFE_INTEGER)}),{code:'TRANSFER_FEE_POLICY_NOT_APPROVED'});
});
test('missing quote secret cannot be silently replaced with a fallback',()=>{
 delete process.env.TRANSFER_QUOTE_HMAC_KEY;
 try{assert.throws(issued,{code:'TRANSFER_FEE_POLICY_NOT_APPROVED'});}finally{process.env.TRANSFER_QUOTE_HMAC_KEY='a9'.repeat(32);}
});
test('source boundary always holds payout amount plus fee and one-time quote ID',()=>{
 const service=readFileSync(resolve(root,'apps/api/src/modules/finance/application/transfer.service.ts'),'utf8');
 const controller=readFileSync(resolve(root,'apps/api/src/modules/finance/presentation/finance.controller.ts'),'utf8');
 const migration=readFileSync(resolve(root,'packages/database/prisma/migrations/0012_bank_transfer_quotes_beneficiaries/migration.sql'),'utf8');
 assert.match(service,/amountMinor: BigInt\(quote\.totalDebitMinor\)/);
 assert.match(service,/feeMinor: BigInt\(quote\.feeMinor\)/);
 assert.match(service,/approvalQuoteId: quote\.id/);
 assert.match(service,/financial\.amountMinor \+ financial\.feeMinor/);
 assert.match(service,/feeAccount \? \[/);
 assert.match(controller,/amountMinor: totalDebitMinor, intent: 'TRANSFER'/);
 assert.match(migration,/UNIQUE INDEX "bank_transfers_approvalQuoteId_key"/);
});

test('beneficiary list, rename and archive always scope writes by owner',async()=>{
  const rel='apps/api/src/modules/finance/application/transfer.service.ts';
  const js=ts.transpileModule(readFileSync(resolve(root,rel),'utf8'),{fileName:rel,
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
  const calls=[];
  const database={beneficiary:{
    findMany:async arg=>{calls.push(['findMany',arg]);return [{id:'b1',accountNumberLast4:'1234',bankCode:'057',accountName:'Amina Musa',nickname:null,currency:'NGN'}]},
    updateMany:async arg=>{calls.push(['updateMany',arg]);return {count:1}},
  }};
  const mocked={exports:{}};
  new Function('require','module','exports',js)((id)=>{
    if(id==='@nestjs/common')return {Injectable:()=>x=>x,ConflictException:ApiError,ForbiddenException:ApiError,NotFoundException:ApiError};
    if(id==='@twipay/security')return {fingerprintSensitiveValue:()=>'',encryptSensitiveString:()=>''};
    if(id==='@twipay/ledger')return {LedgerInvariantError:class extends Error{}};
    if(id==='./transfer-quote.js')return {issueTransferQuote,verifyTransferQuote};
    if(id==='./reference.js')return {createFinancialReference:()=> 'xfer:test'};
    throw Error(`Unexpected import ${id}`);
  },mocked,mocked.exports);
  const TransferService=mocked.exports.TransferService;
  const service=new TransferService(database,{}, {}, {}, {}, {}, {});
  const entries=await service.savedBeneficiaries('user-1');
  assert.equal(entries.length,1);assert.equal(entries[0].accountNumberMasked,'******1234');
  assert.equal(entries[0].accountNumberLast4,undefined);
  await service.renameSavedBeneficiary('user-1','b1','Family');
  await service.removeSavedBeneficiary('user-1','b1');
  const [read,rename,archive]=calls;
  assert.equal(read[1].where.userId,'user-1');assert.equal(read[1].where.saved,true);
  assert.deepEqual(rename[1].where,{id:'b1',userId:'user-1',saved:true,archivedAt:null});
  assert.deepEqual(archive[1].where,{id:'b1',userId:'user-1',saved:true,archivedAt:null});
  assert.equal(archive[1].data.saved,false);assert.ok(archive[1].data.archivedAt instanceof Date);
});
test('archived and missing saved recipients cannot be changed or removed for a different actor',async()=>{
  const rel='apps/api/src/modules/finance/application/transfer.service.ts';
  const js=ts.transpileModule(readFileSync(resolve(root,rel),'utf8'),{fileName:rel,
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
  const mocked={exports:{}};
  new Function('require','module','exports',js)((id)=>{
    if(id==='@nestjs/common')return {Injectable:()=>x=>x,ConflictException:ApiError,ForbiddenException:ApiError,NotFoundException:ApiError};
    if(id==='@twipay/security')return {fingerprintSensitiveValue:()=>'',encryptSensitiveString:()=>''};
    if(id==='@twipay/ledger')return {LedgerInvariantError:class extends Error{}};
    if(id==='./transfer-quote.js')return {issueTransferQuote,verifyTransferQuote};
    if(id==='./reference.js')return {createFinancialReference:()=> 'xfer:test'};
    throw Error(`Unexpected import ${id}`);
  },mocked,mocked.exports);
  const service=new mocked.exports.TransferService({beneficiary:{updateMany:async()=>({count:0})}},{},{},{},{},{},{});
  await assert.rejects(()=>service.renameSavedBeneficiary('wrong-user','recipient',null),{code:'BENEFICIARY_NOT_FOUND'});
  await assert.rejects(()=>service.removeSavedBeneficiary('wrong-user','recipient'),{code:'BENEFICIARY_NOT_FOUND'});
});
test('fee and beneficiary identity snapshots stay attached to transfer ledger history',()=>{
 const service=readFileSync(resolve(root,'apps/api/src/modules/finance/application/transfer.service.ts'),'utf8');
 const controller=readFileSync(resolve(root,'apps/api/src/modules/finance/presentation/finance.controller.ts'),'utf8');
 assert.match(service,/accountNameSnapshot: resolved\.accountName/);
 assert.match(service,/accountLast4Snapshot: accountNumberLast4/);
 assert.match(service,/approvalQuoteId: quote\.id/);
 assert.match(controller,/bankTransfer\.accountNameSnapshot \?\?/);
 assert.match(controller,/transaction\.type === 'TRANSFER' \? \{ totalDebitMinor:/);
});
