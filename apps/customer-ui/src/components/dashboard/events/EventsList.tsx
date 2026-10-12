import {useMemo,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {LuClock3,LuSearch,LuTag} from 'react-icons/lu';
import {HiOutlineLocationMarker} from 'react-icons/hi';
import BackButton from '@/components/Authentication/BackButton';
import {useNavigate} from 'react-router-dom';
import useEventsStore from '@/stores/useEventsStore';
import {listPublishedEvents,listEventOrders} from '@/lib/api/dashboard-apis/events';
import {formatNgnMinorUnits} from '@/lib/money';

const fmtDate=(value:string)=>new Date(value).toLocaleString('en-NG',{dateStyle:'medium',timeStyle:'short'});
export default function EventsList(){
 const {selectedEvent,update}=useEventsStore();const navigate=useNavigate();const [search,setSearch]=useState('');
 const catalogue=useQuery({queryKey:['twipay','published-events'],queryFn:listPublishedEvents,retry:false});
 const orders=useQuery({queryKey:['twipay','event-orders'],queryFn:listEventOrders,retry:false});
 const filtered=useMemo(()=>catalogue.data?.filter(event=>`${event.title} ${event.organizer.name} ${event.venueName??''}`.toLowerCase().includes(search.trim().toLowerCase()))??[],[catalogue.data,search]);
 return <div className="w-full">
    <div className="max-md:hidden"><BackButton className="mb-8" action={()=>navigate(-1)}/><h1 className="text-[#112929] text-2xl font-medium">Select Events</h1><p className="text-[#344054]">Please select the event you want to attend</p></div>
    <div className="relative mt-16 md:mt-2"><input aria-label="Search events" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search events" className="w-full h-12 bg-white border border-[#344054]/20 focus:outline-[#112929]/50 rounded-lg placeholder:text-xs placeholder:text-[#344054] pl-10"/><span className="absolute left-4 top-1/2 -translate-y-1/2"><LuSearch className="text-[#344054] size-4"/></span></div>
    <section className="mt-5"><div className="flex flex-col gap-5">
      {catalogue.isPending&&<p className="text-[#667085]" role="status">Loading published events…</p>}
      {catalogue.isError&&<p className="text-red-600" role="alert">Events cannot be loaded right now. Please retry.</p>}
      {catalogue.isSuccess&&filtered.length===0&&<p className="text-[#667085]">No published events match your search.</p>}
      {filtered.map(event=>{
        const cheapest=event.ticketTypes.filter(t=>t.status==='ACTIVE').map(t=>BigInt(t.priceMinor)).sort((a,b)=>a<b?-1:a>b?1:0)[0];
        return <button key={event.id} type="button" aria-pressed={selectedEvent===event.id} onClick={()=>update({selectedEvent:event.id,selectedTicketTypeId:null,quantity:1,quote:null})} className={`relative bg-white border col-span-full md:col-span-1 rounded-md p-3 transition cursor-pointer hover:opacity-90 text-left ${selectedEvent===event.id?'border-[#112929]':'border-transparent hover:border-[#112929]'}`}>
          <div className="flex items-center gap-3 mb-2.5 pt-2"><span aria-hidden className="size-10 rounded-full bg-[#112929]/10 text-[#112929] grid place-items-center">✦</span><h2 className="font-bold text-xl text-[#334054]">{event.title}</h2></div>
          <p className="font-medium text-xs text-[#667085] text-left mb-3 opacity-80 line-clamp-2">{event.description||`Hosted by ${event.organizer.name}`}</p>
          <div className="flex flex-wrap gap-2 items-center text-[#475367]"><span className="flex gap-1 items-center text-xs"><HiOutlineLocationMarker/>{event.venueName||'Venue to be announced'}</span><span className="flex gap-1 items-center text-xs"><LuClock3/>{fmtDate(event.startsAt)}</span><span className="flex gap-1 items-center text-sm"><LuTag/>{cheapest===undefined?'Tickets unavailable':`From ${formatNgnMinorUnits(cheapest.toString())}`}</span></div>
        </button>;
      })}
    </div></section>
    <section className="mt-7 border-t border-[#F0F2F5] pt-5"><h2 className="font-medium text-[#112929] text-lg">My bookings</h2>
      {orders.isPending&&<p className="text-[#667085] text-sm">Loading bookings…</p>}
      {orders.isError&&<p role="alert" className="text-red-600 text-sm">Booking history is temporarily unavailable.</p>}
      {orders.data?.length===0&&<p className="text-[#667085] text-sm">You have no recorded event orders.</p>}
      {orders.data?.map(order=><div key={order.reference} className="bg-white rounded-lg p-3 mt-3 text-sm text-[#344054] border border-[#F0F2F5]"><p className="font-medium">{order.event?.title||order.eventTitle||'Event booking'}</p><p>Reference: {order.reference}</p><p>Status: {order.status} · {formatNgnMinorUnits(order.totalMinor)}</p><p>{order.tickets.map(t=>t.publicCode).join(', ')}</p></div>)}
    </section>
  </div>;
}
