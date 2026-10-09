/** Phase 5.4: actual service behavior under deterministic in-memory Prisma seams, not real PG/provider/browser tests. */
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
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
class ApiError extends Error {constructor(body){super(body.code);this.code=body.code;}}
function compile(file,deps={}){
 const output=ts.transpileModule(read(file),{fileName:file,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
 const exports={};vm.runInNewContext(output,{exports,require:(name)=>{
  if(name==='@nestjs/common')return {Injectable:()=>value=>value,NotFoundException:ApiError};
  if(name==='@twipay/security')return {encryptSensitiveString:v=>`encrypted:${v}`,fingerprintSensitiveValue:v=>`fingerprint:${v}`,decryptSensitiveString:v=>v.slice('encrypted:'.length)};
  if(name in deps)return deps[name];
  if(name.endsWith('.js'))return {};
  throw Error('unexpected '+name);
 },process:{env:{DATA_ENCRYPTION_KEY:'testkey',PII_FINGERPRINT_KEY:'testkey'}},Date,Buffer,Array,Object,Set,Map,Number,String,Error,Math});return exports;
}
const template=compile('apps/api/src/modules/notifications/application/inbox-policy.ts').safeInboxTemplate;
function harness(){
 const notifications=[],inbox=[],pref=new Map(),attempts=[];
 let currentId=0;
 const preference={findUnique:async({where})=>pref.get(where.userId)||null,upsert:async({where,create,update})=>{const v={...pref.get(where.userId),...(!pref.has(where.userId)?create:update)};pref.set(where.userId,v);return v;}};
 const notification={
  findUnique:async({where})=>notifications.find(n=>n.id===where.id||n.idempotencyKey===where.idempotencyKey)||null,
  findUniqueOrThrow:async({where})=>notifications.find(n=>n.id===where.id)??Promise.reject(new Error("not found")),
  findMany:async({where})=>notifications.filter(n=>where.userId?n.userId===where.userId:(!n.deliverySuppressed)).map(n=>({...n,attempts:[]})),
  create:async({data})=>{const id=`${(++currentId).toString().padStart(8,'0')}-1111-4111-8111-111111111111`;const n={id,status:'PENDING',updatedAt:new Date(),createdAt:new Date(),...data};delete n.inboxItem;notifications.push(n);
   if(data.inboxItem)inbox.push({id:`${currentId.toString().padStart(8,'0')}-2222-4222-8222-222222222222`,notificationId:id,readAt:null,createdAt:new Date(),...data.inboxItem.create});return n;},
  update:async({where,data})=>{const n=notifications.find(x=>x.id===where.id);Object.assign(n,data);return n;},
  groupBy:async()=>[{status:'PENDING',deliverySuppressed:false,_count:{_all:1}}],
 };
 const inboxRepo={
  findMany:async({where,take})=>inbox.filter(i=>i.userId===where.userId && (!where.OR || where.OR.some(o=>o.createdAt?.lt?i.createdAt<o.createdAt.lt:(i.createdAt.getTime()===o.createdAt.getTime()&&i.id<o.id.lt)))).sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime()||b.id.localeCompare(a.id)).slice(0,take),
  count:async({where})=>inbox.filter(i=>i.userId===where.userId&&i.readAt===where.readAt).length,
  updateMany:async({where,data})=>{let count=0;for(const i of inbox)if(i.userId===where.userId&&(!where.id||i.id===where.id)&&i.readAt===null){i.readAt=data.readAt;count++;}return {count};},
  findFirst:async({where})=>inbox.find(i=>i.userId===where.userId&&i.id===where.id)||null,
 };
 const db={notification,notificationInboxItem:inboxRepo,notificationPreference:preference,notificationAttempt:{count:async()=>0},$transaction:async(fn)=>typeof fn==='function'?fn(db):Promise.all(fn),$queryRaw:async()=>[{id:'locked'}]};
 const providers={get:()=>({send:async()=>({status:'ACCEPTED',providerCode:'local'})})};
 const Service=compile('apps/api/src/modules/notifications/application/notification.service.ts',{'./inbox-policy.js':{safeInboxTemplate:template}}).NotificationService;
 const service=new Service(db,providers);
 const enqueue=(userId,templateCode,key=`key-${++currentId}`,text='Secret code 123456')=>service.enqueueWithTx(db,{userId,channel:'EMAIL',templateCode,destination:'person@example.test',subject:'A secret subject',text,idempotencyKey:key});
 return {service,inbox,notifications,attempts,pref,enqueue,db};
}
test('safe templates are allowlisted and never mirror provider bodies or OTP codes',()=>{assert.equal(template('PASSWORD_RECOVERY'),null);assert.equal(template('CONTACT_EMAIL_VERIFICATION'),null);assert.equal(template('TRANSACTION_PIN_RESET'),null);assert.equal(template('PASSWORD_ENROLLMENT'),null);assert.equal(template('ARBITRARY_TEMPLATE'),null);assert.equal(template('SUPPORT_REPLY').message.includes('123456'),false);});
test('support reply creates fixed safe inbox body, never destination, message text or subject',async()=>{const h=harness();await h.enqueue(A,'SUPPORT_REPLY','support-k','SECRET_OTP_123456');assert.equal(h.inbox.length,1);const view=await h.service.listInbox(A);assert.equal(view.unreadCount,1);assert.equal(view.items[0].title,'Support has replied');assert.ok(!JSON.stringify(view).includes('SECRET_OTP'));assert.ok(!JSON.stringify(view).includes('example.test'));assert.ok(!JSON.stringify(view).includes('secret subject'));});
test('credential delivery creates no inbox item while preserving email delivery record',async()=>{const h=harness();for(const code of ['PASSWORD_RECOVERY','CONTACT_EMAIL_VERIFICATION','TRANSACTION_PIN_RESET','PASSWORD_ENROLLMENT'])await h.enqueue(A,code,code);assert.equal(h.notifications.length,4);assert.equal(h.inbox.length,0);});
test('inbox reads are owner-scoped; repeated reads idempotent',async()=>{const h=harness();await h.enqueue(A,'EVENT_TICKETS_ISSUED');const id=h.inbox[0].id;await assert.rejects(h.service.markRead(B,id),{code:'INBOX_ITEM_NOT_FOUND'});assert.equal((await h.service.listInbox(A)).unreadCount,1);assert.equal((await h.service.markRead(A,id)).updated,true);assert.equal((await h.service.markRead(A,id)).updated,false);assert.equal((await h.service.listInbox(A)).unreadCount,0);});
test('mark-all-read affects only owner, including unseen items',async()=>{const h=harness();await h.enqueue(A,'SUPPORT_REPLY');await h.enqueue(A,'EVENT_TICKETS_ISSUED');await h.enqueue(B,'SUPPORT_REPLY');assert.equal((await h.service.markAllRead(A)).updatedCount,2);assert.equal((await h.service.listInbox(B)).unreadCount,1);assert.equal((await h.service.markAllRead(A)).updatedCount,0);});
test('preferences persist per owner, defaults safe and security alerts cannot be disabled',async()=>{const h=harness();assert.deepEqual(JSON.parse(JSON.stringify(await h.service.getPreferences(A))),{supportInApp:true,eventInApp:true,supportEmail:true});await h.service.savePreferences(A,{supportInApp:false,eventInApp:false,supportEmail:false});await h.enqueue(A,'SUPPORT_REPLY');await h.enqueue(A,'EVENT_TICKETS_ISSUED');await h.enqueue(A,'TRANSACTION_PIN_SECURITY_ALERT');await h.enqueue(B,'SUPPORT_REPLY');assert.equal(h.inbox.filter(x=>x.userId===A).length,1);assert.equal(h.inbox.filter(x=>x.userId===B).length,1);assert.equal(h.notifications[0].deliverySuppressed,true);assert.equal(h.notifications[1].deliverySuppressed,false);});
test('duplicate idempotency key never creates another inbox record',async()=>{const h=harness();await h.enqueue(A,'SUPPORT_REPLY','repeat');await h.enqueue(A,'SUPPORT_REPLY','repeat');assert.equal(h.notifications.length,1);assert.equal(h.inbox.length,1);});
test('optional delivery is suppressed when preferences change before provider dispatch',async()=>{const h=harness();const n=await h.enqueue(A,'SUPPORT_REPLY');await h.service.savePreferences(A,{supportInApp:true,eventInApp:true,supportEmail:false});await h.service.deliver(n.id);assert.equal(h.notifications[0].deliverySuppressed,true);assert.equal(h.notifications[0].status,'PENDING');});
test('ops delivery summary only aggregates statuses and suppression',async()=>{const h=harness();const result=await h.service.deliverySummary();assert.deepEqual(JSON.parse(JSON.stringify(result)),{counts:[{status:'PENDING',suppressed:false,count:1}]});assert.ok(!JSON.stringify(result).includes('userId'));});
test('controller enforces verified session, strict preferences and owner selection; ops needs MFA and dedicated permission',()=>{const c=read('apps/api/src/modules/notifications/presentation/notifications.controller.ts');const o=read('apps/api/src/modules/notifications/presentation/notification-operations.controller.ts');assert.match(c,/@UseGuards\(SessionAuthGuard\)/);assert.match(c,/@Put\('preferences'\)/);assert.match(c,/PreferenceSchema.*strict\(\)/);assert.match(c,/requirePrincipal\(req\)\.userId/);assert.match(o,/@UseGuards\(SessionAuthGuard, PermissionGuard\)/);assert.match(o,/ops\.notifications\.read/);assert.match(o,/requireMfa\(req\)/);});
test('migrations enforce owner foreign keys, unique source notification, and no finance mutations',()=>{const m=read('packages/database/prisma/migrations/0017_notification_inbox_preferences/migration.sql');assert.match(m,/"notificationId" UUID NOT NULL UNIQUE/);assert.match(m,/"userId" UUID NOT NULL REFERENCES "users"/);assert.match(m,/ops.notifications.read/);assert.doesNotMatch(m,/ledger_entries|wallet_holds|financial_transactions|provider_operations/);});
test('UI forbids arbitrary redirect, caches no OTP and honors optional controls',()=>{const ui=read('apps/customer-ui/src/lib/api/dashboard-apis/notificationsApi.ts');const prefs=read('apps/customer-ui/src/routes/dashboard/foundations/NotificationPreferences.tsx');const ops=read('apps/admin/app/notifications/page.tsx');assert.match(ui,/allowedPaths=new Set/);assert.doesNotMatch(ui,/localStorage|sessionStorage|verificationCode/);assert.match(prefs,/getNotificationPreferences/);assert.match(prefs,/saveNotificationPreferences/);assert.match(ops,/delivery-summary/);assert.doesNotMatch(ops,/destinationCiphertext|bodyCiphertext|releaseHold/);});

test('pagination is stable and foreign cursor cannot expose another account',async()=>{const h=harness();for(let i=0;i<52;i++)await h.enqueue(A,'SUPPORT_REPLY',`many-${i}`);await h.enqueue(B,'SUPPORT_REPLY','other');const first=await h.service.listInbox(A);assert.equal(first.items.length,50);assert.equal(first.hasMore,true);assert.equal(first.unreadCount,52);const second=await h.service.listInbox(A,first.nextCursor);assert.equal(second.items.length,2);assert.equal(second.hasMore,false);assert.ok(second.items.every(x=>!first.items.some(y=>y.id===x.id)));const foreign=h.inbox.find(x=>x.userId===B).id;await assert.rejects(h.service.listInbox(A,foreign),{code:'INBOX_CURSOR_NOT_FOUND'});});
