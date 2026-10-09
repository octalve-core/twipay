import {useState, type FormEvent} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {FoundationPage,FoundationPanel,FoundationUnavailable,FoundationLink} from '@/components/design-system/ErhaFoundationUI';
import {listMyOrganizers} from '@/lib/api/dashboard-apis/organizers';
import {listManagedEvents,createMyOrganizer,createEventDraft,addEventTicketType,publishManagedEvent} from '@/lib/api/dashboard-apis/organizerDrafts';
import {formatNgnMinorUnits} from '@/lib/money';
import EventStaffManagement from './EventStaffManagement';

const field='w-full rounded-lg border border-[#D0D5DD] p-3 text-sm text-[#344054] focus-visible:outline-2 focus-visible:outline-[#112929]';
const action='rounded-lg bg-[#112929] px-5 py-3 text-sm font-medium text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#112929]';
const message=(error:unknown)=>error instanceof Error&&error instanceof TypeError?error.message:'We could not save your changes. Please review your details or try again later.';
const toSlug=(value:string)=>value.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,120);
function positiveMinor(value:string):string|null {return /^(?:[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(value)?(BigInt(value.split('.')[0])*100n+BigInt((value.split('.')[1]||'').padEnd(2,'0'))).toString():null;}

/** Original ErhaPay foundation. Draft configuration cannot activate payments or settlement. */
export default function OrganizerOverview(){
 const client=useQueryClient();
 const query=useQuery({queryKey:['twipay','my-organizers'],queryFn:listMyOrganizers,retry:false});
 const [selected,setSelected]=useState('');
 const organizerId=query.data?.some(row=>row.id===selected)?selected:query.data?.[0]?.id??'';
 const events=useQuery({queryKey:['twipay','managed-events',organizerId],queryFn:()=>listManagedEvents(organizerId),enabled:!!organizerId,retry:false});
 const [organizerName,setOrganizerName]=useState('');
 const [eventTitle,setEventTitle]=useState('');const [eventDate,setEventDate]=useState('');const [venue,setVenue]=useState('');
 const [ticketEvent,setTicketEvent]=useState('');const [ticketName,setTicketName]=useState('General admission');const [ticketPrice,setTicketPrice]=useState('');const [ticketCapacity,setTicketCapacity]=useState('');
 const [notice,setNotice]=useState('');const [error,setError]=useState('');
 const publishEnabled=import.meta.env.VITE_TWIPAY_EVENT_ORGANIZER_SANDBOX_ENABLED==='true';
 const mutation=useMutation({mutationFn:async(task:()=>Promise<void>)=>task(),onSuccess:async()=>{setError('');setNotice('Your changes have been saved.');await client.invalidateQueries({queryKey:['twipay','my-organizers']});await client.invalidateQueries({queryKey:['twipay','managed-events']});},onError:(err:unknown)=>{setNotice('');setError(message(err));}});
 function submit(event:FormEvent,actionFn:()=>Promise<void>){event.preventDefault();setError('');setNotice('');if(!mutation.isPending)mutation.mutate(actionFn);}
 return <FoundationPage title="Organizer centre" description="Create your organizer profile and prepare events with TwiPay.">
  <FoundationPanel title="Organizer profiles" description="Event payments and public publishing remain restricted until independently approved.">
   {query.isPending&&<p className="mt-4 text-[#667085] text-sm" role="status">Loading your organizer details…</p>}
   {query.isError&&<p className="mt-4 text-red-700 text-sm" role="alert">We couldn't load your organizer details. Please try again later.</p>}
   {query.data?.length===0&&<p className="mt-4 text-[#667085] text-sm">No organizer profiles are linked to this account.</p>}
   {query.data?.map(organizer=><article key={organizer.id} className="mt-3 rounded-lg border border-[#F0F2F5] p-4"><h3 className="text-[#112929] font-medium">{organizer.name}</h3><p className="text-[#667085] text-sm mt-1">Status: {organizer.status} · {organizer.eventCount} {organizer.eventCount===1?'event':'events'}</p></article>)}
   <form onSubmit={event=>submit(event,async()=>{await createMyOrganizer(organizerName,toSlug(organizerName));setOrganizerName('');})} className="mt-5 space-y-3"><label htmlFor="organizer-name" className="block text-sm font-medium text-[#344054]">New organizer name</label><input id="organizer-name" value={organizerName} onChange={e=>setOrganizerName(e.target.value)} minLength={2} maxLength={120} required className={field} placeholder="Organization or event brand"/><button type="submit" className={action} disabled={mutation.isPending||query.isError||organizerName.trim().length<2}>Create organizer</button></form>
  </FoundationPanel>
  <FoundationPanel title="Prepare events" description="Event drafts and tickets are saved to your organizer profile. They do not collect money.">
   {query.data&&query.data.length>0&&<><label htmlFor="event-organizer" className="block text-sm font-medium text-[#344054] mt-4">Choose organizer</label><select id="event-organizer" className={field} value={organizerId} onChange={e=>{setSelected(e.target.value);setTicketEvent('');}}>{query.data.map(o=><option key={o.id} value={o.id}>{o.name} — {o.status}</option>)}</select></>}
   {!!organizerId&&query.data?.find(o=>o.id===organizerId)?.status==='ACTIVE'&&<form className="mt-5 grid gap-3" onSubmit={e=>submit(e,async()=>{const when=new Date(eventDate);if(!Number.isFinite(when.getTime())||when<=new Date())throw new TypeError('Choose a future event date');await createEventDraft({organizerId,title:eventTitle,slug:toSlug(eventTitle),startsAt:when.toISOString(),...(venue.trim()?{venueName:venue.trim()}:{})});setEventTitle('');setEventDate('');setVenue('');})}>
    <label htmlFor="event-draft-title" className="text-sm font-medium text-[#344054]">Event title</label><input id="event-draft-title" className={field} value={eventTitle} minLength={3} maxLength={120} onChange={e=>setEventTitle(e.target.value)} placeholder="Event name" required/>
    <label htmlFor="event-start" className="text-sm font-medium text-[#344054]">Event date and time</label><input id="event-start" type="datetime-local" className={field} value={eventDate} onChange={e=>setEventDate(e.target.value)} required/>
    <label htmlFor="event-venue" className="text-sm font-medium text-[#344054]">Venue (optional)</label><input id="event-venue" className={field} value={venue} maxLength={220} onChange={e=>setVenue(e.target.value)} placeholder="Where it takes place"/>
    <button type="submit" disabled={mutation.isPending} className={action}>Save event draft</button>
   </form>}
   {events.isPending&&organizerId&&<p className="text-sm text-[#667085] mt-4" role="status">Loading events…</p>}
   {events.isError&&<p className="text-sm text-red-700 mt-4" role="alert">Unable to load your events.</p>}
   {events.data?.length===0&&<p className="text-sm text-[#667085] mt-4">No events created for this organizer yet.</p>}
   {events.data?.map(item=><article key={item.id} className="mt-4 border border-[#F0F2F5] rounded-lg p-4"><h3 className="text-[#112929] font-medium">{item.title}</h3><p className="mt-1 text-sm text-[#667085]">{item.status} · {new Date(item.startsAt).toLocaleString()} · {item.orderCount} orders</p>{item.ticketTypes.map(ticket=><p key={ticket.id} className="mt-2 text-xs text-[#475467]">{ticket.name} — {formatNgnMinorUnits(ticket.priceMinor)} · {ticket.capacity} capacity · {ticket.status}</p>)}{item.ticketTypes.length===0&&<p className="text-sm text-[#667085] mt-2">Add a ticket type before requesting publication.</p>}{item.status==='DRAFT'&&item.ticketTypes.length>0&&<button type="button" className="mt-3 text-sm underline text-[#112929] disabled:opacity-50" disabled={!publishEnabled||mutation.isPending} onClick={()=>mutation.mutate(()=>publishManagedEvent(item.id))}>Request sandbox publication</button>}{['PUBLISHED','SOLD_OUT'].includes(item.status)&&<EventStaffManagement eventId={item.id} eventTitle={item.title}/>}</article>)}
   {events.data?.some(e=>e.status==='DRAFT')&&<form className="mt-6 grid gap-3" onSubmit={e=>submit(e,async()=>{const amount=positiveMinor(ticketPrice);if(!amount)throw new TypeError('Enter a valid ticket price');await addEventTicketType(ticketEvent,ticketName,amount,Number(ticketCapacity));setTicketName('General admission');setTicketPrice('');setTicketCapacity('');})}>
    <h3 className="text-[#112929] font-semibold">Add tickets to a draft</h3>
    <label htmlFor="ticket-draft-event" className="text-sm text-[#344054]">Event draft</label><select id="ticket-draft-event" className={field} required value={events.data.some(e=>e.id===ticketEvent&&e.status==='DRAFT')?ticketEvent:''} onChange={e=>setTicketEvent(e.target.value)}><option value="">Select an event</option>{events.data.filter(e=>e.status==='DRAFT').map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select>
    <label htmlFor="ticket-draft-name" className="text-sm text-[#344054]">Ticket name</label><input id="ticket-draft-name" className={field} minLength={2} maxLength={160} required value={ticketName} onChange={e=>setTicketName(e.target.value)}/>
    <label htmlFor="ticket-draft-price" className="text-sm text-[#344054]">Ticket price (₦)</label><input id="ticket-draft-price" className={field} inputMode="decimal" required value={ticketPrice} onChange={e=>setTicketPrice(e.target.value)} placeholder="5000.00"/>
    <label htmlFor="ticket-draft-capacity" className="text-sm text-[#344054]">Ticket capacity</label><input id="ticket-draft-capacity" className={field} type="number" min={1} max={1000000} required value={ticketCapacity} onChange={e=>setTicketCapacity(e.target.value)}/>
    <button className={action} disabled={mutation.isPending||!ticketEvent} type="submit">Save ticket type</button>
   </form>}
   {!publishEnabled&&<p role="status" className="mt-4 text-sm text-[#667085]">Public event publishing is not yet enabled. Your drafts remain private.</p>}
   {error&&<p role="alert" className="mt-4 text-red-700 text-sm">{error}</p>}{notice&&<p role="status" className="mt-4 text-[#112929] text-sm">{notice}</p>}
  </FoundationPanel>
  <FoundationPanel title="Organizer settlements"><FoundationUnavailable title="Settlement payouts" description="Payout requests and settlement management are not available here yet."/><FoundationLink to="/dashboard/events" title="Browse events" description="See public events currently available on TwiPay."/><FoundationLink to="/dashboard/event-check-in" title="Event check-in" description="Authorized organizers and staff can verify admission when available."/></FoundationPanel>
 </FoundationPage>;
}
