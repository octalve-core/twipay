import {useQuery} from '@tanstack/react-query';
import {FoundationPage,FoundationPanel,FoundationLink} from '@/components/design-system/ErhaFoundationUI';
import {listEventOrders} from '@/lib/api/dashboard-apis/events';
import {formatNgnMinorUnits} from '@/lib/money';
import TicketQrPanel from './TicketQrPanel';
/** Real authenticated order history only; never synthesize a ticket QR or success result. */
export default function MyTickets(){
 const orders=useQuery({queryKey:['twipay','my-event-orders'],queryFn:listEventOrders,retry:false});
 return <FoundationPage title="My tickets" description="See your event bookings and their latest status.">
  <FoundationPanel title="Event orders" description="Your booking details appear here after an order is recorded. Check back if payment is still being processed."><button type="button" onClick={()=>void orders.refetch()} className="mt-3 rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm text-[#344054]" disabled={orders.isFetching}>Refresh ticket status</button>
   {orders.isPending&&<p role="status" className="text-[#667085] mt-4 text-sm">Loading your bookings…</p>}
   {orders.isError&&<p role="alert" className="text-red-700 mt-4 text-sm">We couldn't load your bookings. Please try again later.</p>}
   {orders.data?.length===0&&<p className="text-[#667085] mt-4 text-sm">You don't have any event bookings yet.</p>}
   {orders.data?.map(order=><article key={order.reference} className="rounded-lg border border-[#F0F2F5] mt-4 p-4" aria-label={`Order ${order.reference}`}>
     <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium text-[#112929]">{order.event?.title??order.eventTitle??'Event booking'}</h3><span className="text-xs text-[#475467] bg-[#F9FAFB] px-2 py-1 rounded-md">{order.status}</span></div>
     <p className="mt-2 text-xs text-[#667085] break-all">Order {order.reference}</p>
     <p className="mt-1 text-sm text-[#344054]">{formatNgnMinorUnits(order.totalMinor)} · {order.tickets.length} {order.tickets.length===1?'ticket':'tickets'}</p>
     {order.status==='PAID'&&order.tickets.length>0?<div className="mt-3"><p className="text-sm text-[#344054] font-medium">Your ticket details</p>{order.tickets.map(ticket=><div className="border-b border-[#F0F2F5] py-2 last:border-0" key={ticket.publicCode}><p className="text-xs text-[#667085] break-all">{ticket.ticketType??'Ticket'} · {ticket.publicCode} · {ticket.status??'Status unavailable'}</p>{ticket.status==='ACTIVE'&&<TicketQrPanel reference={order.reference} publicCode={ticket.publicCode}/>}</div>)}<p className="mt-2 text-xs text-[#667085]">A ticket can be presented only when its order and admission status are valid.</p></div>:<p className="mt-2 text-xs text-[#667085]">No confirmed admission ticket is available for this order.</p>}
   </article>)}
   <FoundationLink to="/dashboard/events" title="Explore events" description="Browse upcoming events and available tickets."/>
  </FoundationPanel>
 </FoundationPage>;
}
