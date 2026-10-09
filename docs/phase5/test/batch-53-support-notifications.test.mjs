/** Phase 5.3 dependency-light actual-service tests with in-memory Prisma transaction seams; no PG/provider qualification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const root=resolve(import.meta.dirname,'../../..');
const read=path=>readFileSync(resolve(root,path),'utf8');
class ApiError extends Error{constructor(body){super(body.code);this.code=body.code;}}
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222', STAFF='33333333-3333-4333-8333-333333333333';
const K1='44444444-4444-4444-8444-444444444444',K2='55555555-5555-4555-8555-555555555555',K3='66666666-6666-4666-8666-666666666666';
function compile(file){const output=ts.transpileModule(read(file),{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;const exports={};vm.runInNewContext(output,{exports,require:(name)=>{
  if(name==='@nestjs/common')return {ConflictException:ApiError,NotFoundException:ApiError,HttpException:class extends ApiError{},Injectable:()=>v=>v};
  if(name==='node:crypto')return {randomUUID:()=>K3};
  if(name==='@twipay/security')return {encryptSensitiveString:(v)=>`sealed:${Buffer.from(v).toString('base64')}`,decryptSensitiveString:(v)=>Buffer.from(v.slice(7),'base64').toString('utf8')};
  if(name.endsWith('.js'))return {};
  throw Error(`unexpected import ${name}`);
 },process:{env:{DATA_ENCRYPTION_KEY:'test-only'}},Date,Buffer,Error,Set,Map,BigInt,Array,Object,Number,String,RegExp});return exports;}
function harness({verified=true}={}){
 const rows=[], messages=[],audit=[],emails=[],queries=[];
 const tx={
  $queryRaw:async(strings,...args)=>{const sql=strings.join('?');queries.push(sql);if(sql.includes('FROM "users"'))return [{id:args[0]}];const found=rows.find(r=>r.reference===args[0]&&(!sql.includes('"userId"')||r.userId===args[1]));return found?[{id:found.id}]:[];},
  supportCase:{
   findUnique:async({where,include})=>{const item=rows.find(r=>where.requestKey?r.requestKey===where.requestKey:r.reference===where.reference);return item?(include?.messages?{...item,messages:messages.filter(m=>m.caseId===item.id)}:item):null;},
   findUniqueOrThrow:async({where})=>rows.find(r=>r.reference===where.reference)??Promise.reject(new Error('not found')),
   findFirst:async({where})=>{const item=rows.find(r=>r.reference===where.reference&&r.userId===where.userId);return item?{...item,messages:messages.filter(m=>m.caseId===item.id)}:null;},
   findFirstOrThrow:async({where})=>rows.find(r=>r.reference===where.reference&&r.userId===where.userId)??Promise.reject(new Error('not found')),
   findMany:async({where})=>rows.filter(r=>where.userId?r.userId===where.userId:(where.status?.not?r.status!==where.status.not:true)),
   count:async({where})=>rows.filter(r=>r.userId===where.userId).length,
   create:async({data})=>{const item={id:K3,reference:data.reference,userId:data.userId,requestKey:data.requestKey,category:data.category,subjectCiphertext:data.subjectCiphertext,status:'WAITING_SUPPORT',createdAt:new Date(),updatedAt:new Date()};rows.push(item);return item;},
   update:async({where,data})=>{const item=rows.find(r=>r.id===where.id);Object.assign(item,data,{updatedAt:new Date()});return item;}
  },
  supportMessage:{
   findUnique:async({where})=>messages.find(m=>m.requestKey===where.requestKey)||null,
   count:async({where})=>messages.filter(m=>m.caseId===where.caseId).length,
   create:async({data})=>{const m={id:`msg-${messages.length}`,createdAt:new Date(),...data};messages.push(m);return m;}
  },
  user:{findUnique:async()=>({email:'person@example.test',emailVerifiedAt:verified?new Date():null})},
 };
 const db={$transaction:async(fn)=>fn(tx),supportCase:tx.supportCase};
 const auditing={recordWithTx:async(_tx,input)=>audit.push(input)};
 const notifier={enqueueWithTx:async(_tx,input)=>emails.push(input)};
 const Service=compile('apps/api/src/modules/operations/application/customer-support.service.ts').CustomerSupportService;
 return {svc:new Service(db,auditing,notifier),rows,messages,audit,emails,queries};
}
const open=(userId=A,requestKey=K1)=>({userId,category:'GENERAL',subject:'Question about my account',message:'I need help with my account.',requestKey});
test('owner creates encrypted support request, and listing exposes metadata only',async()=>{const h=harness();const item=await h.svc.create(open());assert.equal(item.status,'WAITING_SUPPORT');assert.equal(h.messages.length,1);assert.ok(h.messages[0].bodyCiphertext.startsWith('sealed:'));assert.ok(!JSON.stringify(h.rows).includes('I need help'));assert.ok(!JSON.stringify(h.rows).includes('Question about my account'));const result=await h.svc.listForCustomer(A);assert.equal(result.length,1);assert.ok(!JSON.stringify(result).includes('I need help'));assert.equal((await h.svc.listForCustomer(B)).length,0);});
test('same request key replay is idempotent, changed payload and foreign key reuse rejected',async()=>{const h=harness();const item=await h.svc.create(open());assert.equal((await h.svc.create(open())).reference,item.reference);assert.equal(h.messages.length,1);await assert.rejects(h.svc.create({...open(),message:'Different support text'}),{code:'SUPPORT_REQUEST_KEY_CONFLICT'});await assert.rejects(h.svc.create(open(B)),{code:'SUPPORT_REQUEST_KEY_CONFLICT'});});
test('customer detail and replies enforce ownership under row lock',async()=>{const h=harness();const c=await h.svc.create(open());await assert.rejects(h.svc.customerDetail(B,c.reference),{code:'SUPPORT_CASE_NOT_FOUND'});await assert.rejects(h.svc.customerReply({userId:B,reference:c.reference,message:'Intruder',requestKey:K2}),{code:'SUPPORT_CASE_NOT_FOUND'});await h.svc.customerReply({userId:A,reference:c.reference,message:'More context',requestKey:K2});assert.equal(h.messages.length,2);assert.equal(h.audit.length,1);assert.equal((await h.svc.customerDetail(A,c.reference)).messages[1].text,'More context');assert.ok(h.queries.some(q=>q.includes('FOR UPDATE')));});
test('customer reply replay is single write; altered text cannot reuse key',async()=>{const h=harness();const c=await h.svc.create(open());const args={userId:A,reference:c.reference,message:'Reply again',requestKey:K2};await h.svc.customerReply(args);await h.svc.customerReply(args);assert.equal(h.messages.length,2);await assert.rejects(h.svc.customerReply({...args,message:'Modified reply'}),{code:'SUPPORT_REQUEST_KEY_CONFLICT'});});
test('staff reply requires existing open case and emits generic notification, not message body',async()=>{const h=harness();const c=await h.svc.create(open());await h.svc.staffReply({reference:c.reference,staffUserId:STAFF,message:'We have an update.',requestKey:K2});assert.equal(h.rows[0].status,'WAITING_CUSTOMER');assert.equal(h.audit[0].action,'SUPPORT_REPLY');assert.equal(h.emails.length,1);assert.ok(!JSON.stringify(h.emails).includes('We have an update.'));assert.equal(h.messages.length,2);assert.equal((await h.svc.staffDetail(c.reference)).messages[1].text,'We have an update.');});
test('unverified email receives no delivery notification',async()=>{const h=harness({verified:false});const c=await h.svc.create(open());await h.svc.staffReply({reference:c.reference,staffUserId:STAFF,message:'Please sign in.',requestKey:K2});assert.equal(h.emails.length,0);});
test('staff reply idempotency does not duplicate audit, email or message',async()=>{const h=harness();const c=await h.svc.create(open());const args={reference:c.reference,staffUserId:STAFF,message:'Support reply',requestKey:K2};await h.svc.staffReply(args);await h.svc.staffReply(args);assert.equal(h.audit.length,1);assert.equal(h.emails.length,1);assert.equal(h.messages.length,2);await assert.rejects(h.svc.staffReply({...args,message:'Changed'}),{code:'SUPPORT_REQUEST_KEY_CONFLICT'});});
test('closing a case blocks both customer and staff replies; repeated close does not duplicate audit',async()=>{const h=harness();const c=await h.svc.create(open());await h.svc.staffClose({reference:c.reference,staffUserId:STAFF});await h.svc.staffClose({reference:c.reference,staffUserId:STAFF});assert.equal(h.audit.length,1);await assert.rejects(h.svc.customerReply({userId:A,reference:c.reference,message:'Further question',requestKey:K2}),{code:'SUPPORT_CASE_CLOSED'});await assert.rejects(h.svc.staffReply({staffUserId:STAFF,reference:c.reference,message:'Extra info',requestKey:K3}),{code:'SUPPORT_CASE_CLOSED'});});
test('daily support-creation limit denies sixth case',async()=>{const h=harness();for(let i=0;i<5;i++)await h.svc.create(open(A,`${String(i).repeat(8)}-4444-4444-8444-444444444444`));await assert.rejects(h.svc.create(open(A,K2)),{code:'SUPPORT_DAILY_LIMIT'});assert.equal(h.rows.length,5);});
test('controllers enforce permissions, session and MFA; no finance mutations or attachment intake',()=>{
 const customer=read('apps/api/src/modules/operations/presentation/customer-operations.controller.ts');const ops=read('apps/api/src/modules/operations/presentation/operations.controller.ts');const migration=read('packages/database/prisma/migrations/0016_customer_support_conversations/migration.sql');const svc=read('apps/api/src/modules/operations/application/customer-support.service.ts');
 assert.match(customer,/@UseGuards\(SessionAuthGuard\)/);assert.match(customer,/@Post\('support\/cases'\)/);
 assert.match(ops,/@RequirePermissions\('ops.support.read'\)/);assert.match(ops,/@Get\('support\/cases'\)[^\n]*requireMfa\(req\)/);assert.match(ops,/@RequirePermissions\('ops.support.reply'\)/);assert.match(ops,/@Post\('support\/cases\/:reference\/replies'\)[\s\S]{0,250}requireMfa\(req\)/);
 assert.match(migration,/support_message_append_only/);assert.match(migration,/support_case_closed_terminal/);assert.match(svc,/FOR UPDATE/);assert.doesNotMatch(svc,/\.ledger\.|\.refundRequest\.|\.providerOperation\./);assert.doesNotMatch(customer,/upload|multipart|fileStorage/i);
});
test('ErhaPay routes call allowlisted protected API and separate safe inbox from delivery history',()=>{
 const axios=read('apps/customer-ui/src/lib/api/axios.ts');const page=read('apps/customer-ui/src/routes/dashboard/foundations/SupportCentre.tsx');const notification=read('apps/customer-ui/src/lib/api/dashboard-apis/notificationsApi.ts');
 assert.match(axios,/support\\\/cases/);assert.match(page,/openSupportCase/);assert.match(page,/replySupportCase/);assert.match(page,/Never include passwords/);assert.doesNotMatch(page,/localStorage|sessionStorage/);assert.match(notification,/getNotificationInbox/);assert.match(notification,/markNotificationRead/);
});

test('support mutations have dedicated rate limits, not the generic default',()=>{const code=read('apps/api/src/platform/http/risk-rate-limit.ts');assert.match(code,/bucket: 'customer-support', max: 8/);assert.match(code,/path === '\/v1\/support\/cases'/);});

test('financial dispute review is read-only with independent permission and MFA',()=>{const c=read('apps/api/src/modules/operations/presentation/operations.controller.ts');const svc=read('apps/api/src/modules/operations/application/dispute-refund.service.ts');const admin=read('apps/admin/app/support/page.tsx');assert.match(c,/@Get\('disputes'\) @RequirePermissions\('ops.disputes.review'\)[^\n]*requireMfa\(req\)/);assert.match(svc,/listReviewDisputes\(\)/);assert.match(svc,/take: 100/);assert.match(admin,/Financial dispute review \(read only\)/);assert.doesNotMatch(admin,/approveAndExecuteEventRefund|releaseHold/);});
