import {useQuery} from '@tanstack/react-query';
import CustomButton from '@/components/CustomButton';
import useEventsStore from '@/stores/useEventsStore';
import {listPublishedEvents,getPublishedEvent} from '@/lib/api/dashboard-apis/events';
import {formatNgnMinorUnits} from '@/lib/money';
import Clock from '@/assets/dashboard/clock-icon.svg';
import Location from '@/assets/dashboard/location-icon.svg';
import Tag from '@/assets/dashboard/tag-icon.svg';
export default function EventDetails(){
 const {selectedEvent,selectedTicketTypeId,quantity,update}=useEventsStore();
 const catalogue=useQuery({queryKey:['twipay','published-events'],queryFn:listPublishedEvents,retry:false});
 const selected=catalogue.data?.find(e=>e.id===selectedEvent);
 const detail=useQuery({queryKey:['twipay','event-detail',selected?.slug],queryFn:()=>getPublishedEvent(selected!.slug),enabled:!!selected,retry:false});
 const event=detail.data;const ticket=event?.ticketTypes.find(t=>t.id===selectedTicketTypeId);
 return <div className="w-full md:sticky md:top-0 md:h-[80vh] md:overflow-y-auto hide-scrollbar mt-7 md:mt-0">
  {!selectedEvent&&<p className="hidden md:block text-[#667085]">Choose an event to view ticket options.</p>}
  {detail.isPending&&selectedEvent&&<p role="status" className="text-[#667085]">Loading event details…</p>}
  {detail.isError&&<p role="alert" className="text-red-600">Event details are unavailable.</p>}
  {event&&<><div className="flex items-start gap-[22px]"><div className="size-[90px] md:size-[137px] bg-[#112929]/10 text-[#112929] rounded-[10px] grid place-items-center text-3xl">✦</div><div><h2 className="text-xl text-[#1C1B19] font-medium mb-3">{event.title}</h2><p className="text-sm text-[#667085]">{event.description||`Hosted by ${event.organizer.name}`}</p></div></div>
    <div className="mt-[30px]"><h3 className="text-lg text-[#1D2739] font-medium mb-3">{new Date(event.startsAt).toLocaleDateString('en-NG',{dateStyle:'full'})}</h3><div className="flex flex-col gap-3">
      <div className="flex items-center gap-3"><img src={Clock} alt=""/><span className="text-sm text-[#475367]">{new Date(event.startsAt).toLocaleTimeString('en-NG',{timeStyle:'short'})}</span></div>
      <div className="flex items-center gap-3"><img src={Location} alt=""/><span className="text-sm text-[#475367]">{[event.venueName,event.venueAddress].filter(Boolean).join(' · ')||'Venue to be announced'}</span></div>
      <div className="flex items-center gap-3"><img src={Tag} alt=""/><span className="text-sm text-[#475367]">{ticket?formatNgnMinorUnits(ticket.priceMinor):'Select a ticket type'}</span></div>
    </div></div>
    <div className="border-t-2 border-b-2 border-[#F0F2F5] mt-9 mb-8 py-7 flex flex-col gap-4">
      <label className="text-sm text-[#344054] font-medium" htmlFor="event-ticket-type">Ticket type</label>
      <select id="event-ticket-type" value={selectedTicketTypeId||''} onChange={e=>update({selectedTicketTypeId:e.target.value,quote:null})} className="bg-white border border-[#D0D5DD] rounded-lg py-2.5 px-3 text-[#344054]"><option value="">Choose a ticket</option>{event.ticketTypes.filter(t=>t.status==='ACTIVE').map(t=><option key={t.id} value={t.id}>{t.name} — {formatNgnMinorUnits(t.priceMinor)}</option>)}</select>
      <label className="text-sm text-[#344054] font-medium" htmlFor="event-quantity">Quantity (1–20)</label><input id="event-quantity" type="number" min={1} max={20} value={quantity} onChange={e=>update({quantity:Math.max(1,Math.min(20,Number(e.target.value)||1)),quote:null})} className="bg-white border border-[#D0D5DD] rounded-lg py-2.5 px-3 text-[#344054]"/>
      <p className="text-xs text-[#667085]">Final price and platform fee will be calculated by TwiPay before confirmation.</p>
    </div>
    <CustomButton onClick={()=>update({step:2})} disabled={!ticket||ticket.status!=='ACTIVE'||event.status!=='PUBLISHED'} className="w-full">Proceed - <span className="opacity-60">enter details</span></CustomButton>
  </>}
 </div>;
}
