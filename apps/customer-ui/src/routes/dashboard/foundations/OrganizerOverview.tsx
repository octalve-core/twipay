import {useQuery} from '@tanstack/react-query';
import {FoundationPage,FoundationPanel,FoundationUnavailable,FoundationLink} from '@/components/design-system/ErhaFoundationUI';
import {listMyOrganizers} from '@/lib/api/dashboard-apis/organizers';
/** Read-only owner-scoped organizer records; no fabricated settlement totals or operational actions. */
export default function OrganizerOverview(){
 const query=useQuery({queryKey:['twipay','my-organizers'],queryFn:listMyOrganizers,retry:false});
 return <FoundationPage title="Organizer centre" description="Keep track of your events and organizer profile.">
  <FoundationPanel title="Your organizer profiles">
   {query.isPending&&<p className="mt-4 text-[#667085] text-sm" role="status">Loading your organizer details…</p>}
   {query.isError&&<p className="mt-4 text-red-700 text-sm" role="alert">We couldn't load your organizer details. Please try again later.</p>}
   {query.data?.length===0&&<p className="mt-4 text-[#667085] text-sm">No organizer profiles are linked to this account.</p>}
   {query.data?.map(organizer=><article key={organizer.id} className="mt-4 rounded-lg border border-[#F0F2F5] p-4"><h3 className="text-[#112929] font-medium">{organizer.name}</h3><p className="text-[#667085] text-sm mt-1">Status: {organizer.status} · {organizer.eventCount} {organizer.eventCount===1?'event':'events'}</p></article>)}
  </FoundationPanel>
  <FoundationPanel title="Manage events">
   <FoundationUnavailable title="Create and manage events" description="Event creation, staff invitations and organizer reports will become available after account permissions are ready."/>
   <FoundationUnavailable title="Organizer settlements" description="Payout requests and settlement management are not available here yet."/>
   <FoundationLink to="/dashboard/events" title="Browse events" description="See events currently listed on TwiPay."/>
  </FoundationPanel>
 </FoundationPage>;
}
