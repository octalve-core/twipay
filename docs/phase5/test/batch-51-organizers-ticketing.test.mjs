/** Phase 5.1 source-contract/isolated tests; no live database, payout or ticket issuance. */
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
const uuid='11111111-1111-4111-8111-111111111111';
const eventId='22222222-2222-4222-8222-222222222222';
function adapter(){
 const filename='apps/customer-ui/src/lib/api/dashboard-apis/organizerDrafts.ts';
 const src=read(filename).replaceAll("import.meta.env.VITE_TWIPAY_EVENT_ORGANIZER_SANDBOX_ENABLED", "'false'");
 const compiled=ts.transpileModule(src,{fileName:filename,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const holder={exports:{}};const calls=[];
 vm.runInNewContext(compiled,{exports:holder.exports,require(name){if(name==='../axios')return {__esModule:true,default:{get:async(path)=>{calls.push({method:'GET',path});return {data:{events:[]}};},post:async(path,body)=>{calls.push({method:'POST',path,body});return {data:{}};}}};throw Error(name);},TypeError,Error,Date,RegExp,Number,Object,Array,BigInt,String});
 return {api:holder.exports,calls};
}
function managed(overrides={}){return {id:eventId,organizerId:uuid,title:'Community Festival',slug:'community-festival',status:'DRAFT',startsAt:'2027-01-01T10:00:00.000Z',orderCount:0,ticketTypes:[{id:'33333333-3333-4333-8333-333333333333',name:'General',priceMinor:'150000',capacity:100,status:'ACTIVE'}],...overrides};}
test('read-only organizer summary stays separate from authenticated organizer mutation adapter',()=>{
 assert.doesNotMatch(read('apps/customer-ui/src/lib/api/dashboard-apis/organizers.ts'),/\.post\(/);
 assert.match(read('apps/customer-ui/src/lib/api/dashboard-apis/organizerDrafts.ts'),/createMyOrganizer|createEventDraft|addEventTicketType/);
});
test('managed event response only accepts the selected owner-scoped organizer and ticket metadata',()=>{
 const {api}=adapter();const data=api.readManagedEvents({events:[{...managed(),settlement:{balance:100},ticketTypes:[{...managed().ticketTypes[0],credentialCiphertext:'do-not-return'}]}]},uuid);
 assert.equal(data.length,1);assert.equal(data[0].ticketTypes[0].priceMinor,'150000');
 assert.doesNotMatch(JSON.stringify(data),/settlement|credentialCiphertext/);
});
test('cross-organizer events, unbounded arrays and malformed monetary fields are rejected',()=>{
 const {api}=adapter();
 for(const raw of [{events:[managed({organizerId:eventId})]},{events:new Array(101).fill(managed())},{events:[managed({ticketTypes:[{...managed().ticketTypes[0],priceMinor:'-100'}]})]},{events:[managed({orderCount:-1})]},{events:[managed({status:'REFUNDED'})]}]){
  assert.throws(()=>api.readManagedEvents(raw,uuid));
 }
});
test('draft/organizer/ticket writes use only existing authenticated contracts and validate input',async()=>{
 const {api,calls}=adapter();await api.createMyOrganizer('Regional Association','regional-association');
 await api.createEventDraft({organizerId:uuid,title:'Community Festival',slug:'community-festival',startsAt:'2028-01-01T12:00:00Z'});
 await api.addEventTicketType(eventId,'General','150000',100);
 assert.deepEqual(calls.map(c=>c.path),['/events/organizers','/events',`/events/${eventId}/ticket-types`]);
 assert.equal(calls[0].body.name,'Regional Association');assert.equal(calls[0].body.slug,'regional-association');
 assert.equal(calls[2].body.priceMinor,'150000');
});
test('invalid draft dates, invalid ticket prices, and inappropriate quantities do not reach API',async()=>{
 const {api,calls}=adapter();
 await assert.rejects(api.createEventDraft({organizerId:uuid,title:'Community Festival',slug:'festival',startsAt:'2020-01-01T00:00:00Z'}));
 await assert.rejects(api.addEventTicketType(eventId,'General','0',100));
 await assert.rejects(api.addEventTicketType(eventId,'General','150000',0));
 await assert.rejects(api.createMyOrganizer('Test Org','UPPER-CASE'));
 assert.equal(calls.length,0);
});
test('owner organizer reads do not accept a supplied customer user ID',async()=>{
 const {api,calls}=adapter();const result=await api.listManagedEvents(uuid);assert.equal(result.length,0);
 assert.equal(calls[0].path,`/events/organizers/${uuid}/events`);
});
test('publication is off by default in customer adapter and server independently rejects production',async()=>{
 const {api,calls}=adapter();await assert.rejects(api.publishManagedEvent(eventId),/not available/);assert.equal(calls.length,0);
 const service=read('apps/api/src/modules/events/application/event.service.ts');
 const flag=read('.env.example');assert.match(service,/NODE_ENV'\] === 'production'[\s\S]*EVENT_PUBLISH_SANDBOX_ENABLED'\] !== 'true'/);assert.match(flag,/EVENT_PUBLISH_SANDBOX_ENABLED=false/);
});
test('authenticated API enforces owner identity on organizer, event, ticket creation and publication',()=>{
 const controller=read('apps/api/src/modules/events/presentation/events.controller.ts');
 const service=read('apps/api/src/modules/events/application/event.service.ts');
 for(const route of ["@Post('organizers')","@Post()","@Post(':eventId/ticket-types')","@Post(':eventId/publish')"]){const index=controller.indexOf(route);assert.ok(index>=0,route);assert.match(controller.slice(index,index+650),/SessionAuthGuard/);}
 assert.match(service,/event\.organizer\.ownerUserId !== input\.ownerUserId/);
 assert.match(service,/ownerUserId: input\.ownerUserId/);
 assert.match(service,/event\.organizer\.ownerUserId !== ownerUserId/);
});
test('ErhaPay organizer forms preserve old foundation, avoid fabricated settlements and require sandbox for publishing',()=>{
 const ui=read('apps/customer-ui/src/routes/dashboard/foundations/OrganizerOverview.tsx');
 for(const symbol of ['FoundationPage','FoundationPanel','listMyOrganizers','createMyOrganizer','createEventDraft','addEventTicketType','publishManagedEvent'])assert.ok(ui.includes(symbol),symbol);
 assert.match(ui,/VITE_TWIPAY_EVENT_ORGANIZER_SANDBOX_ENABLED/);
 assert.doesNotMatch(ui,/requestPayout|availableBalance|accountNumber|\.post\(|localStorage|window\.fetch/);
});
test('customer event checkout requires PIN and acknowledgement, does not persist PIN in retry storage',()=>{
 const ui=read('apps/customer-ui/src/components/dashboard/events/ConfirmEventsBooking.tsx');
 const api=read('apps/customer-ui/src/lib/api/dashboard-apis/events.ts');
 assert.match(ui,/type="password" inputMode="numeric" autoComplete="off"/);
 assert.match(ui,/\/\^\\d\{4\}\$\/\.test\(pin\)&&ack/);
 assert.match(ui,/checkoutEvent\(quote\.data,recipientName,attempt\.key,pin\)/);
 assert.match(ui,/finally\{setPin\(''\)/);
 assert.match(api,/expectedTotalMinor:quote\.totalMinor,transactionPin/);
 assert.match(api,/\/\^\\d\{4\}\$\/\.test\(transactionPin\)/);
 assert.doesNotMatch(ui,/sessionStorage\.setItem\([^\n]*pin/);
});
test('financial event checkout stays default off; ticket credentials remain sandbox gated and not stored in idempotency responses',()=>{
 const controller=read('apps/api/src/modules/events/presentation/events.controller.ts');
 const service=read('apps/api/src/modules/events/application/event.service.ts');
 assert.match(controller,/NODE_ENV'\] === 'production' \|\| process\.env\['EVENT_CHECKOUT_SANDBOX_ENABLED'\] !== 'true'/);
 assert.match(controller,/EVENT_TICKET_QR_SANDBOX_ENABLED/);
 assert.match(service,/publicCheckoutResponse\(idem\.replay\.body\)/);
 assert.match(service,/credentialCiphertext: encryptSensitiveString/);
 assert.doesNotMatch(read('apps/customer-ui/src/lib/api/dashboard-apis/events.ts'),/qrPayload|localStorage/);
});

/** Exercise the actual EventService lock/status code using disposable in-memory seams. */
function serviceHarness({status='DRAFT',organizerStatus='ACTIVE',owner=uuid,tickets=1,publishAllowed=true}={}){
 const sourcePath='apps/api/src/modules/events/application/event.service.ts';
 const code=ts.transpileModule(read(sourcePath),{fileName:sourcePath,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
 class ApiError extends Error {constructor(value){super(value.code);this.code=value.code;}}
 const exports={};const logs=[];
 vm.runInNewContext(code,{exports,require(name){
  if(name==='@nestjs/common')return {BadRequestException:ApiError,ConflictException:ApiError,NotFoundException:ApiError,Injectable:()=>klass=>klass};
  if(name==='@twipay/events')return {assertEventTransition:(old,next)=>{logs.push(`transition:${old}:${next}`);if(old!=='DRAFT')throw new ApiError({code:'INVALID_EVENT_TRANSITION'});}};
  return {};
 },process:{env:{NODE_ENV:'test',EVENT_PUBLISH_SANDBOX_ENABLED:publishAllowed?'true':'false'}},Date,BigInt,Error,Promise,Map,Number,String});
 const event={id:eventId,status,startsAt:new Date('2030-01-01T00:00:00Z'),organizer:{ownerUserId:owner,status:organizerStatus},ticketTypes:Array.from({length:tickets},()=>({id:uuid,status:'ACTIVE'}))};
 const tx={$queryRaw:async()=>{logs.push('event-lock');return [{id:eventId}]},event:{findUnique:async()=>{logs.push('event-read');return event},update:async({data})=>{logs.push(`update:${data.status}`);return {...event,...data}}},eventTicketType:{create:async({data})=>{logs.push('ticket-create');return data}}};
 const db={$transaction:async callback=>{logs.push('start-tx');return callback(tx)}};
 const svc=new exports.EventService(db,{}, {}, {}, {}, {}, {});
 return {svc,logs};
}
test('server publishing hard-stops with no sandbox gate without touching database',async()=>{
 const {svc,logs}=serviceHarness({publishAllowed:false});await assert.rejects(svc.publish(uuid,eventId),{code:'EVENT_PUBLISH_NOT_QUALIFIED'});
 assert.deepEqual(logs,[]);
});
test('publication locks event before reading and rejects foreign ownership, suspended organizers and missing tickets',async()=>{
 for(const scenario of [{owner:eventId},{organizerStatus:'SUSPENDED'},{tickets:0}]){
  const {svc,logs}=serviceHarness(scenario);await assert.rejects(svc.publish(uuid,eventId));
  assert.deepEqual(logs.slice(0,3),['start-tx','event-lock','event-read']);assert.equal(logs.some(item=>item.startsWith('update:')),false);
 }
});
test('successful approved sandbox publication and ticket writes both serialize on the event row',async()=>{
 const {svc,logs}=serviceHarness();await svc.publish(uuid,eventId);
 assert.deepEqual(logs,['start-tx','event-lock','event-read','transition:DRAFT:PUBLISHED','update:PUBLISHED']);
 const ticket=serviceHarness();await ticket.svc.createTicketType({ownerUserId:uuid,eventId,name:'General',priceMinor:50000n,capacity:200});
 assert.deepEqual(ticket.logs,['start-tx','event-lock','event-read','ticket-create']);
 const unavailable=serviceHarness({status:'PUBLISHED'});await assert.rejects(unavailable.svc.createTicketType({ownerUserId:uuid,eventId,name:'Late change',priceMinor:50000n,capacity:200}),{code:'EVENT_TICKET_TYPE_CHANGE_NOT_ALLOWED'});
 assert.equal(unavailable.logs.includes('ticket-create'),false);
});
