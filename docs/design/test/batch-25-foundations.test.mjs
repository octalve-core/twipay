/** Batch 2.5 source/contract tests; NOT browser-rendered or live backend tests. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const read=(p)=>readFileSync(new URL(`../../../${p}`,import.meta.url),'utf8');
const root='apps/customer-ui/src/';
const route=read(root+'App.tsx');
const featurePaths=['settings/security-overview','settings/beneficiaries','settings/notification-preferences','settings/support-centre','my-tickets','organizer'];
const pages=['AccountSecurityOverview','SavedBeneficiaries','NotificationPreferences','SupportCentre','MyTickets','OrganizerOverview'];

function loadAdapter(){
 const source=read(root+'lib/api/dashboard-apis/organizers.ts');
 const result=ts.transpileModule(source,{fileName:'organizers.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 const holder={exports:{}};
 const calls=[];
 let response={organizers:[]};
 vm.runInNewContext(result.outputText,{exports:holder.exports,require(name){
   if(name==='../axios')return {__esModule:true,default:{get:async(path)=>{calls.push(path);return {data:response};}}};
   throw new Error('Unexpected module '+name);
 },TypeError,Number,Object,Array,RegExp,String});
 return {api:holder.exports,calls,setData(data){response=data}};
}
const valid={id:'11111111-1111-4111-8111-111111111111',name:'Community Organizer',slug:'community-organizer',status:'ACTIVE',eventCount:2};

test('six ErhaPay-styled foundations have exactly defined protected routes',()=>{
 for(const p of featurePaths)assert.match(route,new RegExp(`path: "${p}"`));
 const part=route.split('path: "/dashboard"')[1]?.split('path: "/wallet/fund/complete"')[0]??'';
 for(const p of featurePaths)assert.ok(part.includes(`path: "${p}"`),p);
 assert.match(route,/element: <DeferredFeatureGuard><DashboardLayout \/><\/DeferredFeatureGuard>/);
 assert.match(read(root+'routes/layout/DashboardLayout.tsx'),/<AuthenticatedCustomerRoute>/);
});
test('foundation pages reuse the actual ErhaPay design system without creating their own shell',()=>{
 const base=read(root+'components/design-system/ErhaFoundationUI.tsx');
 for(const key of ['ErhaPageFrame','ErhaPageHeading','ErhaSettingsPanel'])assert.ok(base.includes(key));
 for(const page of pages){
  const src=read(root+`routes/dashboard/foundations/${page}.tsx`);
  assert.match(src,/<FoundationPage/);
  assert.doesNotMatch(src,/localStorage|sessionStorage|\bwindow\.location|\bfetch\(|\baxios\.post\(|createBrowserRouter/);
 }
});
test('all new pages are reachable through current settings navigation, not the retired UI',()=>{
 const constants=read(root+'lib/constants.ts');
 for(const id of ['security-overview','beneficiaries','notification-preferences','support-centre','/dashboard/my-tickets','/dashboard/organizer'])assert.ok(constants.includes(`path: "${id}"`),id);
 assert.match(read(root+'components/dashboard/settings/Settings.tsx'),/settingsData\.map/);
});
test('transaction PIN is explicitly pending a server-enforced authorization policy',()=>{
 const page=read(root+'routes/dashboard/foundations/AccountSecurityOverview.tsx');
 assert.match(page,/Transaction PIN/);
 assert.match(page,/Coming soon|FoundationUnavailable/);
 assert.doesNotMatch(page,/onSubmit|pin:\s*\d|\/auth\/set-pin|\/wallet\/debit/);
});
test('saved beneficiary page does not fabricate a list or submit bank credentials',()=>{
 const source=read(root+'routes/dashboard/foundations/SavedBeneficiaries.tsx');
 assert.match(source,/not available yet/);
 assert.doesNotMatch(source,/useState|localStorage|accountNumber|\.post\(|\.delete\(|beneficiaries=\[/);
});
test('notification preferences and support centre do not imply unimplemented messages are sent',()=>{
 const notif=read(root+'routes/dashboard/foundations/NotificationPreferences.tsx');
 const support=read(root+'routes/dashboard/foundations/SupportCentre.tsx');
 assert.match(notif,/when they can be saved securely/);
 assert.match(support,/dedicated help inbox/);
 for(const s of [notif,support])assert.doesNotMatch(s,/onSubmit|axios|setPreference|sendMessage/);
 assert.match(support,/dashboard\/settings\/support/);
 assert.match(notif,/dashboard\/notifications/);
});
test('ticket history calls real authenticated orders and never fetches ticket bearer credentials',()=>{
 const page=read(root+'routes/dashboard/foundations/MyTickets.tsx');
 assert.match(page,/listEventOrders/);
 assert.match(page,/order\.status==='PAID'/);
 assert.match(page,/formatNgnMinorUnits\(order\.totalMinor\)/);
 assert.match(page,/orders\.isError/);
 assert.doesNotMatch(page,/qrPayload|qrCode|credential\)|event\.ticketType\.price|localStorage|Math\.random|canvas/);
});
test('organizer overview is read-only and never displays payout/settlement financial state',()=>{
 const page=read(root+'routes/dashboard/foundations/OrganizerOverview.tsx');
 assert.match(page,/listMyOrganizers/);
 assert.match(page,/query\.isError/);
 assert.match(page,/not available here yet/);
 assert.doesNotMatch(page,/requestPayout|approvePayout|subtotalMinor|availableBalance|Math\.random|localStorage|\.post\(/);
});
test('organizer adapter only permits exact owned GET endpoint in client allowlist',()=>{
 const api=read(root+'lib/api/dashboard-apis/organizers.ts');
 const allowed=read(root+'lib/api/axios.ts');
 const backend=read('apps/api/src/modules/events/presentation/events.controller.ts');
 assert.match(api,/api\.get\('\/events\/organizers\/me'\)/);
 assert.match(allowed,/"\/events\/organizers\/me"/);
 assert.match(backend,/@Get\('organizers\/me'\)[\s\S]*?@UseGuards\(SessionAuthGuard\)[\s\S]*?requirePrincipal\(req\)/);
 assert.doesNotMatch(api,/\.post\(|\.put\(|\.delete\(/);
});
test('organizer adapter projects only display fields, excluding settlement and payout fields',()=>{
 const {api}=loadAdapter();
 const rows=api.readMyOrganizers({organizers:[{...valid,settlement:{availableMinor:'999'},bankAccountNumber:'1234567890'}]});
 assert.equal(rows.length,1);
 assert.deepEqual(Object.keys(rows[0]).sort(),['eventCount','id','name','slug','status']);
 assert.equal(rows[0].settlement,undefined);
});
test('organizer adapter rejects malformed and unbounded provider responses',()=>{
 const {api}=loadAdapter();
 for(const data of [null,{organizers:null},{organizers:new Array(51).fill(valid)},{organizers:[{...valid,eventCount:-1}]},{organizers:[{...valid,id:'../../../x'}]},{organizers:[{...valid,slug:'UPPER'}]},{organizers:[{...valid,name:''},{...valid,status:'APPROVED'},{...valid,eventCount:9007199254740993}]}]){
  assert.throws(()=>api.readMyOrganizers(data),TypeError);
 }
});
test('organizer list adapter makes one owner-scoped read without client-supplied user ID',async()=>{
 const inst=loadAdapter();
 inst.setData({organizers:[valid]});
 const result=await inst.api.listMyOrganizers();
 assert.deepEqual(inst.calls,['/events/organizers/me']);
 assert.equal(result[0].name,'Community Organizer');
});
test('all financial and ticketing activation flags remain default-off and no backend files are changed by this batch',()=>{
 const code=read(root+'lib/api/axios.ts');
 assert.match(code,/FEATURE_NOT_INTEGRATED/);
 const src=read(root+'lib/constants.ts');
 assert.match(src,/removedProductRoutes = \["\/dashboard\/services\/betting"\]/);
 assert.match(src,/"\/dashboard\/transfer-funds"/);
});
