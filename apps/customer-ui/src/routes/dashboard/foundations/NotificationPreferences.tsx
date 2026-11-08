import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {FoundationPage,FoundationPanel,FoundationLink} from '@/components/design-system/ErhaFoundationUI';
import {getNotificationPreferences,saveNotificationPreferences,type NotificationPreferences} from '@/lib/api/dashboard-apis/notificationsApi';
import { brand } from "@/config/brand";
const key=['twipay','notification-preferences'];
export default function NotificationPreferencesPage(){
 const query=useQuery({queryKey:key,queryFn:getNotificationPreferences,retry:false});
 const client=useQueryClient();const [changes,setChanges]=useState<NotificationPreferences|null>(null);
 const update=useMutation({mutationFn:saveNotificationPreferences,onSuccess:async()=>{await client.invalidateQueries({queryKey:key});setChanges(null);}});
 const value=changes??query.data;
 function toggle(field:keyof NotificationPreferences){if(value)setChanges({...value,[field]:!value[field]});}
 return <FoundationPage title="Notification preferences" description="Choose which optional updates you receive. Important account security alerts and essential transaction messages cannot be switched off.">
  <FoundationPanel title="Your inbox" description="In-app updates are saved securely on your account."><FoundationLink to="/dashboard/notifications" title="Open notifications" description="View and manage your read and unread updates."/></FoundationPanel>
  <FoundationPanel title="Optional updates" description="You can change these settings whenever you like. They apply to new updates.">
  {query.isPending&&<p role="status">Loading preferences…</p>}{query.isError&&<p role="alert" className="text-red-600">Unable to load your preferences.</p>}
  {value&&<form onSubmit={e=>{e.preventDefault();update.mutate(value);}} className="mt-4 flex flex-col gap-5">
  {([['supportInApp',`Support replies in my ${brand.name} inbox`],['supportEmail','Email me when support replies'],['eventInApp',`Event ticket updates in my ${brand.name} inbox`]] as const).map(([field,label])=><label key={field} className="flex items-center gap-3 text-[#344054] text-sm"><input type="checkbox" checked={value[field]} onChange={()=>toggle(field)} className="size-5 accent-[#112929]"/>{label}</label>)}
  <p className="text-[#667085] text-xs">Security notices remain enabled. Essential ticket-delivery email cannot be disabled here. Opting out of optional support emails does not remove in-app messages already received.</p>
  <button type="submit" disabled={!changes||update.isPending} className="self-start rounded-lg bg-[#112929] px-5 py-3 text-white text-sm disabled:opacity-50">{update.isPending?'Saving…':'Save preferences'}</button>
  {update.isSuccess&&<p role="status" className="text-[#112929] text-sm">Preferences saved.</p>}{update.isError&&<p role="alert" className="text-red-600 text-sm">Unable to save preferences. Please retry.</p>}
  </form>}
  </FoundationPanel></FoundationPage>;
}
