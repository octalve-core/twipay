/** Phase 5.2 isolated security tests. Real PostgreSQL/HTTP/camera/provider tests remain release blockers. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const root=resolve(import.meta.dirname,'../../..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const owner='11111111-1111-4111-8111-111111111111';
const staff='22222222-2222-4222-8222-222222222222';
const stranger='33333333-3333-4333-8333-333333333333';
const eventId='44444444-4444-4444-8444-444444444444';
const ticketId='55555555-5555-4555-8555-555555555555';
const publicCode='TWP-ABCDEFG12345678';
const token='a'.repeat(43);
const qrPayload=`twipay-ticket:v1:${publicCode}:${token}`;
function compile(path,requireStub){
 const code=ts.transpileModule(read(path),{fileName:path,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
 const exports={};
 vm.runInNewContext(code,{exports,require:requireStub,process:{env:{...process.env,TICKET_SIGNING_KEYS_JSON:JSON.stringify({'1':'a'.repeat(40)}),TICKET_SIGNING_CURRENT_VERSION:'1'}},Buffer,BigInt,Error,TypeError,Date,Number,Set,Map,Array,Object,RegExp,String});
 return exports;
}
class ApiError extends Error{constructor(value){super(value?.code??'error');this.code=value?.code;}}
function harness({actor=staff,delegated=true,status='ACTIVE',orderStatus='PAID',eventStatus='PUBLISHED',organizerStatus='ACTIVE',event=eventId,invalidSignature=false,alreadyChecked=false}={}){
 const operations=[];let checked=alreadyChecked;let auditCount=0;let staffActive=delegated;
 const ticket={id:ticketId,publicCode,status,credentialFingerprint:'f'.repeat(64),credentialKeyVersion:1,
  ticketType:{name:'General'},checkIn:alreadyChecked?{checkedInAt:new Date()}:null,
  order:{id:'66666666-6666-4666-8666-666666666666',status:orderStatus,event:{id:event, title:'Community Forum',status:eventStatus,organizer:{ownerUserId:owner,status:organizerStatus}}}};
 const tx={
  $queryRaw:async(strings,...args)=>{
   const query=strings.join('?');
   operations.push(query.includes('event_staff_assignments')?'staff-lock':'ticket-lock');
   return query.includes('event_staff_assignments')?(staffActive?[{id:'77777777-7777-4777-8777-777777777777'}]:[]):[{id:ticketId}];
  },
  eventTicket:{findUnique:async()=>{operations.push('ticket-read');return {...ticket,status:checked?'CHECKED_IN':status,checkIn:checked?{checkedInAt:new Date()}:ticket.checkIn};},update:async()=>{operations.push('ticket-update');checked=true;}},
  ticketCheckIn:{create:async()=>{operations.push('checkin-create');return {checkedInAt:new Date('2026-10-09T21:00:00Z')};}},
  operationalAuditEvent:{create:async({data})=>{operations.push('audit');assert.equal(JSON.stringify(data).includes(qrPayload),false);auditCount++;}},
 };
 const prisma={$transaction:async(fn)=>{operations.push('tx');return fn(tx);},event: {findMany:async()=>[]}};
 const service=compile('apps/api/src/modules/events/application/event.service.ts',name=>{
  if(name==='@nestjs/common')return {BadRequestException:ApiError,ConflictException:ApiError,NotFoundException:ApiError,Injectable:()=>klass=>klass};
  if(name==='@twipay/events')return {extractTicketPublicCode:payload=>{if(payload!==qrPayload)throw new Error('invalid');return publicCode;},parseAndVerifyTicketCredential:payload=>{if(invalidSignature||payload!==qrPayload)throw new Error('bad signature');return {publicCode};}};
  if(name==='@twipay/security')return {decryptSensitiveString:()=>qrPayload,encryptSensitiveString:()=>''};
  if(name.endsWith('event-response.js'))return {};
  if(name==='node:crypto')return {randomUUID:()=>eventId};
  if(name.endsWith('.js'))return {};
  throw Error(`Unexpected import ${name}`);
 });
 const svc=new service.EventService(prisma,{}, {}, {}, {}, {}, {});
 return {svc,operations,get checked(){return checked;},get auditCount(){return auditCount;},revoke(){staffActive=false;},actor};
}
const input=(actor=staff,event=eventId)=>({staffUserId:actor,eventId:event,qrPayload,requestId:'88888888-8888-4888-8888-888888888888'});
test('paid active ticket with active delegated staff is admitted once and audit-logged atomically',async()=>{
 const x=harness();const receipt=await x.svc.checkIn(input());assert.equal(receipt.status,'CHECKED_IN');assert.equal(receipt.eventId,eventId);
 assert.deepEqual(x.operations,['tx','ticket-lock','ticket-read','staff-lock','checkin-create','ticket-update','audit']);assert.equal(x.auditCount,1);
 await assert.rejects(x.svc.checkIn(input()),{code:'TICKET_ALREADY_CHECKED_IN'});assert.equal(x.auditCount,1);
});
test('organizer owner may check in without staff delegation; no escalation to another event',async()=>{
 const x=harness({delegated:false});const receipt=await x.svc.checkIn(input(owner));assert.equal(receipt.status,'CHECKED_IN');assert.equal(x.operations.includes('staff-lock'),false);
 const wrong=harness();await assert.rejects(wrong.svc.checkIn(input(staff,stranger)),{code:'TICKET_NOT_FOUND'});assert.equal(wrong.checked,false);
});
test('foreign staff and revoked delegated staff cannot check in',async()=>{
 for(const actor of [stranger,staff]){const x=harness({delegated:false});await assert.rejects(x.svc.checkIn(input(actor)),{code:'TICKET_NOT_FOUND'});assert.equal(x.operations.includes('checkin-create'),false);}
 const x=harness();x.revoke();await assert.rejects(x.svc.checkIn(input()),{code:'TICKET_NOT_FOUND'});
});
test('invalid credential and mismatched fingerprint cannot authorize check-in',async()=>{
 const x=harness({invalidSignature:true});await assert.rejects(x.svc.checkIn(input()),{code:'TICKET_INVALID_CREDENTIAL'});assert.equal(x.checked,false);
 const y=harness();await assert.rejects(y.svc.checkIn({...input(),qrPayload:'not-a-ticket'}),{code:'TICKET_INVALID_CREDENTIAL'});assert.deepEqual(y.operations,[]);
});
test('invalid financial order and event statuses fail closed before ticket mutation',async()=>{
 for(const options of [{orderStatus:'REFUNDED'},{orderStatus:'FUNDS_RESERVED'},{eventStatus:'CANCELLED'},{eventStatus:'DRAFT'},{organizerStatus:'SUSPENDED'},{status:'CANCELLED'},{status:'REFUNDED'}]){
  const x=harness(options);await assert.rejects(x.svc.checkIn(input()));assert.equal(x.checked,false);assert.equal(x.operations.includes('checkin-create'),false);
 }
});
test('server check-in endpoints are session-protected and sandbox/production-gated',()=>{
 const source=read('apps/api/src/modules/events/presentation/events.controller.ts');
 for(const route of ["@Get('tickets/check-in/assignments')","@Post('tickets/check-in')"]){
  const start=source.indexOf(route);assert.ok(start>=0);const slice=source.slice(start,start+450);assert.match(slice,/SessionAuthGuard/);assert.match(slice,/assertTicketAdmissionSandbox\(\)/);
 }
 assert.match(source,/NODE_ENV'\] === 'production' \|\| process\.env\['EVENT_TICKET_QR_SANDBOX_ENABLED'\] !== 'true'/);
 assert.match(read('.env.example'),/EVENT_TICKET_QR_SANDBOX_ENABLED=false/);
});
test('ticket credential retrieval requires paid owner order and active ticket, response is never publicly cached',()=>{
 const controller=read('apps/api/src/modules/events/presentation/events.controller.ts');
 const svc=read('apps/api/src/modules/events/application/event.service.ts');
 assert.match(svc,/where: \{ userId, reference, status: 'PAID' \}/);
 assert.match(svc,/where: \{ orderId: order.id, publicCode, status: 'ACTIVE' \}/);
 assert.match(svc,/EVENT_TICKET_CREDENTIAL_VIEWED/);
 assert.match(controller,/Cache-Control', 'no-store, private, max-age=0'/);
 assert.match(svc,/credentialFingerprint, key/);
});
test('scan verification locks active staff, refuses unpaid order and produces audit without bearer secrets',()=>{
 const svc=read('apps/api/src/modules/events/application/event.service.ts');
 assert.match(svc,/event_staff_assignments[\s\S]*FOR SHARE/);
 assert.match(svc,/ticket\.order\.status !== 'PAID'/);
 assert.match(svc,/EVENT_TICKET_CHECKED_IN/);
 assert.doesNotMatch(svc,/afterState:\s*\{[^}]*qrPayload/);
});
test('frontend credential adapter does not accept forged/reused or another ticket identity',()=>{
 const exports=compile('apps/customer-ui/src/lib/api/dashboard-apis/ticketAccess.ts',name=>{
  if(name==='../axios')return {__esModule:true,default:{}};
  if(name==='./eventContracts')return {isEventId:v=>/^[0-9a-f-]{36}$/.test(v),isEventReference:()=>true};
  throw Error(name);
 });
 assert.equal(exports.readTicketCredential({ticket:{publicCode,status:'ACTIVE',qrPayload}},publicCode),qrPayload);
 for(const raw of [{ticket:{publicCode,status:'CHECKED_IN',qrPayload}},{ticket:{publicCode:'TWP-OTHEROTHER',status:'ACTIVE',qrPayload}},{ticket:{publicCode,status:'ACTIVE',qrPayload:'bad'}},{ticket:{publicCode,status:'ACTIVE',qrPayload:qrPayload.replace(publicCode,'TWP-OTHEROTHER')}}])assert.throws(()=>exports.readTicketCredential(raw,publicCode));
});
test('ErhaPay ticket UI keeps credential out of localStorage and only displays valid paid/active tickets on demand',()=>{
 const page=read('apps/customer-ui/src/routes/dashboard/foundations/MyTickets.tsx');
 const panel=read('apps/customer-ui/src/routes/dashboard/foundations/TicketQrPanel.tsx');
 assert.match(page,/order\.status==='PAID'/);assert.match(page,/ticket\.status==='ACTIVE'/);
 assert.match(panel,/retrieveTicketCredential\(reference,publicCode\)/);
 assert.match(panel,/QRCode\.toDataURL/);assert.match(panel,/document\.hidden/);assert.match(panel,/60_000/);
 assert.doesNotMatch(page+panel,/localStorage|sessionStorage|console\.log|\.download\(/);
});
test('staff UI requires an assigned event, controls camera permission and clears scans after a result',()=>{
 const ui=read('apps/customer-ui/src/routes/dashboard/foundations/EventCheckIn.tsx');
 assert.match(ui,/VITE_TWIPAY_EVENT_QR_SANDBOX_ENABLED/);
 assert.match(ui,/if\(submitting\.current\|\|!eventId\)return/);
 assert.match(ui,/getUserMedia/);assert.match(ui,/getTracks\(\)\.forEach\(track=>track\.stop\(\)\)/);
 assert.match(ui,/checkInTicket\(eventId,payload,crypto\.randomUUID\(\)\)/);
 assert.doesNotMatch(ui,/localStorage|sessionStorage|console\.log/);
});
function staffInvitationHarness({verified=true,existing='ACTIVE',ownerId=owner}={}){
 const calls=[];
 const assignment={id:'99999999-9999-4999-8999-999999999999',eventId,userId:staff,role:'CHECK_IN',status:existing};
 const prisma={
  event:{findUnique:async()=>({id:eventId,organizer:{ownerUserId:ownerId}})},
  user:{findUnique:async()=>({id:staff,email:'staff@example.com',status:'ACTIVE',emailVerifiedAt:verified?new Date():null})},
  eventStaffAssignment:{upsert:async(args)=>{calls.push(args);return assignment;}},
 };
 const service=compile('apps/api/src/modules/events/application/event.service.ts',name=>{
  if(name==='@nestjs/common')return {BadRequestException:ApiError,ConflictException:ApiError,NotFoundException:ApiError,Injectable:()=>klass=>klass};
  if(name==='node:crypto')return {randomUUID:()=>eventId};
  if(name.endsWith('.js')||name.startsWith('@twipay/'))return {};
  throw Error(`Unexpected import ${name}`);
 });
 return {svc:new service.EventService(prisma,{}, {}, {}, {}, {}, {}),calls};
}
test('staff assignment requires verified email and matching event owner, and never reactivates revoked access',async()=>{
 const unverified=staffInvitationHarness({verified:false});await assert.rejects(unverified.svc.assignCheckInStaff({ownerUserId:owner,eventId,staffEmail:'STAFF@example.com'}),{code:'EVENT_STAFF_USER_NOT_FOUND'});assert.equal(unverified.calls.length,0);
 const foreign=staffInvitationHarness({ownerId:stranger});await assert.rejects(foreign.svc.assignCheckInStaff({ownerUserId:owner,eventId,staffEmail:'staff@example.com'}),{code:'EVENT_NOT_FOUND'});
 const revoked=staffInvitationHarness({existing:'REVOKED'});await assert.rejects(revoked.svc.assignCheckInStaff({ownerUserId:owner,eventId,staffEmail:'staff@example.com'}),{code:'EVENT_STAFF_ASSIGNMENT_REVOKED'});assert.equal(Object.keys(revoked.calls[0].update).length,0);
 const eligible=staffInvitationHarness();const assigned=await eligible.svc.assignCheckInStaff({ownerUserId:owner,eventId,staffEmail:'STAFF@example.com'});assert.equal(assigned.status,'ACTIVE');assert.equal(eligible.calls[0].create.role,'CHECK_IN');
});
test('event staff management uses only narrow owner-scoped API routes, without payouts or financial access',()=>{
 const ui=read('apps/customer-ui/src/routes/dashboard/foundations/EventStaffManagement.tsx');
 const api=read('apps/customer-ui/src/lib/api/dashboard-apis/staffAssignments.ts');
 assert.match(ui,/inviteEventCheckInStaff/);assert.match(ui,/revokeEventCheckInStaff/);
 assert.match(api,/\/events\/\$\{eventId\}\/staff/);assert.match(api,/api\.delete/);
 assert.doesNotMatch(ui+api,/requestPayout|settlementLedgerAccount|localStorage|qrPayload/);
});
