import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {readEvent,readEventList,readEventQuote,readEventOrder,isEventReference} from '../../../apps/customer-ui/src/lib/api/dashboard-apis/eventContracts.ts';
const root=resolve(import.meta.dirname,'../../..');
const read=p=>readFileSync(resolve(root,p),'utf8');
const id='e4fd536b-22e5-4f2d-9a61-7c48113994c5';
const secondId='d4fd536b-22e5-4f2d-9a61-7c48113994c7';
const event={id,slug:'community-night',title:'Community Night',description:null,status:'PUBLISHED',venueName:'Hall A',venueAddress:null,startsAt:'2027-04-01T14:00:00Z',endsAt:null,organizer:{name:'Test Org',slug:'test-org'},ticketTypes:[{id:secondId,name:'Regular',priceMinor:'99999',currency:'NGN',status:'ACTIVE',capacity:100}]};
const expected={eventId:id,ticketTypeId:secondId,quantity:2};
const quote={quote:{eventId:id,currency:'NGN',items:[{ticketTypeId:secondId,quantity:2}],subtotalMinor:'199998',platformFeeMinor:'2000',totalMinor:'201998'}};
const order={reference:'evt-test-123456',status:'PAID',currency:'NGN',subtotalMinor:'199998',platformFeeMinor:'2000',totalMinor:'201998',tickets:[{publicCode:'TWP-TICKET-123',status:'ACTIVE',qrPayload:'private-qr-secret'}]};
test('published events are parsed from API without dummy list',()=>{
 assert.equal(readEventList({events:[event]})[0].ticketTypes[0].priceMinor,'99999');
 assert.deepEqual(readEventList({events:[]}),[]);
 assert.throws(()=>readEventList({events:'dummy'}));
 assert.throws(()=>readEvent({...event,status:'DRAFT'}));
});
test('event adapter rejects forged currency, amounts, ticket IDs and dates',()=>{
 for(const variant of [{...event,startsAt:'invalid'},{...event,ticketTypes:[{...event.ticketTypes[0],priceMinor:'9.99'}]},{...event,ticketTypes:[{...event.ticketTypes[0],currency:'USD'}]},{...event,id:'wrong'}]) assert.throws(()=>readEvent(variant));
});
test('server quote identity matches selected tickets and amount arithmetic',()=>{
 const result=readEventQuote(quote,expected);assert.equal(result.totalMinor,'201998');
 assert.throws(()=>readEventQuote({...quote,quote:{...quote.quote,totalMinor:'200000'}},expected));
 assert.throws(()=>readEventQuote(quote,{...expected,quantity:1}));
 assert.throws(()=>readEventQuote(quote,{...expected,ticketTypeId:id}));
});
test('ticket order parser does not retain QR credential or trust non-integer amounts',()=>{
 const parsed=readEventOrder(order);assert.equal(parsed.status,'PAID');assert.equal(parsed.tickets[0].qrPayload,undefined);
 assert.throws(()=>readEventOrder({...order,totalMinor:'999999'}));
 assert.throws(()=>readEventOrder({...order,totalMinor:'123.00'}));
 assert.throws(()=>readEventOrder({...order,reference:'../danger'}));
});
test('unknown order never becomes PAID in the frontend contract',()=>{
 assert.equal(readEventOrder({...order,status:'UNKNOWN'}).status,'UNKNOWN');
 assert.throws(()=>readEventOrder({...order,status:'SUCCESS'}));
});
test('reference formats are constrained',()=>{assert.equal(isEventReference('evt-2026_01'),true);assert.equal(isEventReference('evil/path'),false);});
test('all active event pages use the actual TwiPay adapter, not dummy prices or local PIN success',()=>{
 const list=read('apps/customer-ui/src/components/dashboard/events/EventsList.tsx');
 const detail=read('apps/customer-ui/src/components/dashboard/events/EventDetails.tsx');
 const confirm=read('apps/customer-ui/src/components/dashboard/events/ConfirmEventsBooking.tsx');
 const result=read('apps/customer-ui/src/components/dashboard/events/Status.tsx');
 assert.match(list,/listPublishedEvents/);assert.doesNotMatch(list,/DummyEventsArray|5ive listening party/);
 assert.match(detail,/getPublishedEvent/);assert.match(confirm,/quoteEventOrder/);assert.match(confirm,/checkoutEvent/);
 assert.doesNotMatch(confirm,/EnterPin|transaction pin/);assert.match(result,/current\?\.status==='PAID'/);assert.doesNotMatch(result,/txnId=1/);
});
test('event backend requires exact quoted total, signed integer bound, ownership and idempotent ledger',()=>{
 const ctl=read('apps/api/src/modules/events/presentation/events.controller.ts');const svc=read('apps/api/src/modules/events/application/event.service.ts');
 assert.match(ctl,/expectedTotalMinor: z\.string\(\)\.regex/);assert.match(ctl,/@Post\('quote'\)/);
 assert.match(svc,/EVENT_QUOTE_CHANGED/);assert.match(svc,/9_223_372_036_854_775_807n/);
 assert.match(svc,/this\.wallets\.reserveWithTx/);assert.match(svc,/this\.ledger\.postWithTx/);assert.match(svc,/this\.idempotency\.completeWithTx/);
 assert.match(svc,/where: \{ userId \}/);assert.match(svc,/where: \{ userId, reference \}/);
});
test('checkout is server- and client-gated independently outside production',()=>{
 const controller=read('apps/api/src/modules/events/presentation/events.controller.ts');
 const api=read('apps/customer-ui/src/lib/api/dashboard-apis/events.ts');
 assert.match(controller,/process\.env\['NODE_ENV'\] === 'production'/);
 assert.match(controller,/EVENT_CHECKOUT_SANDBOX_ENABLED/);
 assert.match(api,/VITE_TWIPAY_EVENT_CHECKOUT_SANDBOX_ENABLED/);
 assert.match(read('.env.example'),/EVENT_CHECKOUT_SANDBOX_ENABLED=false/);
 assert.match(read('apps/customer-ui/.env.example'),/VITE_TWIPAY_EVENT_CHECKOUT_SANDBOX_ENABLED=false/);
});
test('attempt lookup scoped to session principal and idempotency key',()=>{
 const ctl=read('apps/api/src/modules/events/presentation/events.controller.ts');const svc=read('apps/api/src/modules/events/application/event.service.ts');
 assert.match(ctl,/@Get\('checkout-intents\/:key'\)/);assert.match(svc,/userId_scope_key: \{ userId, scope: 'event:checkout', key \}/);
 assert.match(svc,/record\.expiresAt <= new Date\(\)/);
 assert.match(svc,/where: \{ id: record\.resourceId, userId \}/);
});
test('notification delivery API is owner scoped, does not decrypt private message bodies',()=>{
 const controller=read('apps/api/src/modules/notifications/presentation/notifications.controller.ts');const svc=read('apps/api/src/modules/notifications/application/notification.service.ts');
 const narrow=svc.slice(svc.indexOf('async listDeliveryHistory'),svc.indexOf('async enqueue('));
 assert.match(controller,/@UseGuards\(SessionAuthGuard\)/);assert.match(narrow,/where: \{ userId \}/);
 assert.doesNotMatch(narrow,/destinationCiphertext|bodyCiphertext|decryptSensitiveString/);
 assert.doesNotMatch(read('apps/customer-ui/src/components/dashboard/notifications/NotificationList.tsx'),/markAsRead/);
});
test('support disputes are authenticated and ownership-scoped, generic email claims removed',()=>{
 const src=read('apps/customer-ui/src/components/dashboard/settings/Support.tsx');
 const api=read('apps/api/src/modules/operations/presentation/customer-operations.controller.ts');
 const backend=read('apps/api/src/modules/operations/application/dispute-refund.service.ts');
 assert.match(src,/createDispute/);assert.doesNotMatch(src,/Call an agent|Chat on whatsapp/);
 assert.match(api,/@Post\('disputes'\)/);assert.match(backend,/reference: input\.financialReference, userId: input\.userId/);
});
test('refund and organizer payouts remain off until high-risk release qualification',()=>{
 const svc=read('apps/api/src/modules/operations/application/dispute-refund.service.ts');
 assert.match(svc,/assertFeatureEnabled\('events\.refunds', false\)/);
 assert.doesNotMatch(read('apps/customer-ui/src/components/dashboard/events/Status.tsx'),/requestRefund/);
});
test('large valid integer amounts fit PostgreSQL bigint while overflow is rejected',()=>{
 const big={...order,subtotalMinor:'9223372036854775807',platformFeeMinor:'0',totalMinor:'9223372036854775807'};
 assert.equal(readEventOrder(big).totalMinor,big.totalMinor);
 assert.throws(()=>readEventOrder({...big,totalMinor:'9223372036854775808'}));
});
test('notification bell does not claim unsupported unread counts',()=>{
 const header=read('apps/customer-ui/src/components/dashboard/DashboardHeader.tsx');
 assert.doesNotMatch(header,/unreadNotifCount|notif\.read/);
 assert.match(header,/dashboard\/notifications/);
});

test('successful event orders link to existing owner-scoped transaction receipt',()=>{
 const status=read('apps/customer-ui/src/components/dashboard/events/Status.tsx');
 const receipt=read('apps/customer-ui/src/components/receipt/Receipt.tsx');
 assert.match(status,/success&&<CustomButton/);
 assert.match(status,/\/receipt\?txnId=/);
 assert.match(receipt,/getTxnHistoryDetail/);
 assert.match(receipt,/txnDetails\.status !== "success"/);
});
