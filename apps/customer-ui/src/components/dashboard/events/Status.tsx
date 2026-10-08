import SuccessIcon from '@/assets/dashboard/success_icon.svg';
import FailedIcon from '@/assets/dashboard/fail_icon.svg';
import CustomButton from '@/components/CustomButton';
import {useQuery} from '@tanstack/react-query';
import useEventsStore from '@/stores/useEventsStore';
import {getEventOrder} from '@/lib/api/dashboard-apis/events';
import {formatNgnMinorUnits} from '@/lib/money';
export default function Status(){
 const {order}=useEventsStore();const detail=useQuery({queryKey:['twipay','event-order',order?.reference],queryFn:()=>getEventOrder(order!.reference),enabled:!!order?.reference,retry:false});
 const current=detail.data??order;const success=current?.status==='PAID';
 return <div className="grid place-items-center min-h-full w-full"><section className="w-full max-w-[350px] flex flex-col items-center text-center">
  <img className="w-[175px] h-[160px] object-contain" src={success?SuccessIcon:FailedIcon} alt=""/>
  <h1 className="font-medium text-2xl text-[#112929]">{success?'Tickets purchased':current?'Ticket order not confirmed':'No confirmed ticket order'}</h1>
  <p className="md:text-lg font-medium text-center my-6">{current?`Order ${current.reference} · ${formatNgnMinorUnits(current.totalMinor)} · ${current.status}`:'Review your event orders before retrying.'}</p>
  {detail.isError&&<p role="alert" className="text-red-600 text-sm">Unable to refresh order status.</p>}
  {current?.tickets.length? <div className="text-sm text-[#344054] bg-white p-4 rounded-lg w-full text-left"><h2 className="font-medium">Ticket references</h2>{current.tickets.map(ticket=><p className="mt-2 break-all" key={ticket.publicCode}>{ticket.publicCode}{ticket.status?` · ${ticket.status}`:''}</p>)}<p className="text-xs text-[#667085] mt-3">These references are not the entrance QR credentials. Secure QR presentation requires a separate verified ticket display.</p></div>:null}
  {!success&&<p className="text-sm text-[#667085] mt-4">An uncertain order must not be treated as paid. Do not start another purchase until its status is confirmed.</p>}
  {success&&<CustomButton className="w-full mt-6" variant="primary" href={`/receipt?txnId=${encodeURIComponent(current.reference)}`}>View financial transaction receipt</CustomButton>}
  <CustomButton className="w-full mt-2" href="/dashboard/events">View events and bookings</CustomButton><CustomButton className="w-full mt-2" href="/dashboard">Return to dashboard</CustomButton>
 </section></div>;
}
