import {useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import CustomButton from '@/components/CustomButton';
import BackButton from '@/components/Authentication/BackButton';
import useEventsStore from '@/stores/useEventsStore';
import {quoteEventOrder,checkoutEvent,getEventOrder,getCheckoutIntentStatus} from '@/lib/api/dashboard-apis/events';
import {formatNgnMinorUnits} from '@/lib/money';
const storageKey='twipay:event-checkout-intent:v1';
type PendingIntent={key:string;reference?:string};
function readPending():PendingIntent|null {try{const value=JSON.parse(sessionStorage.getItem(storageKey)||'null') as PendingIntent|null;return value&&/^twipay-event:[0-9a-f-]{36}$/.test(value.key)&&(value.reference===undefined||/^[A-Za-z0-9._:-]{1,100}$/.test(value.reference))?value:null;}catch{return null;}}
function savePending(value:PendingIntent){sessionStorage.setItem(storageKey,JSON.stringify(value));}
export default function ConfirmEventsBooking(){
 const {selectedEvent,selectedTicketTypeId,quantity,recipientName,update}=useEventsStore();const queryClient=useQueryClient();
 const sandbox=import.meta.env.VITE_TWIPAY_EVENT_CHECKOUT_SANDBOX_ENABLED==='true';
 const [pending,setPending]=useState<PendingIntent|null>(()=>readPending());const [checkedStatus,setCheckedStatus]=useState<string|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [pin,setPin]=useState('');const [ack,setAck]=useState(false);const locked=useRef(false);
 const quote=useQuery({queryKey:['twipay','event-quote',selectedEvent,selectedTicketTypeId,quantity],queryFn:()=>quoteEventOrder(selectedEvent!,selectedTicketTypeId!,quantity),enabled:!!selectedEvent&&!!selectedTicketTypeId&&quantity>=1&&quantity<=20,retry:false});
 const canSubmit=!!quote.data&&sandbox&&!busy&&!!recipientName&&/^\d{4}$/.test(pin)&&ack&&(!pending||checkedStatus==='NOT_FOUND');
 async function onCheckout(){
   if(locked.current||!canSubmit||!quote.data)return;
   setError('');locked.current=true;setBusy(true);
   try{
     // Persist the key *before* network transmission, so an uncertain outcome cannot be retried with a new key.
     const attempt=pending??{key:`twipay-event:${crypto.randomUUID()}`};savePending(attempt);setPending(attempt);setCheckedStatus(null);
     const order=await checkoutEvent(quote.data,recipientName,attempt.key,pin);
     const stored={...attempt,reference:order.reference};savePending(stored);setPending(stored);update({order,quote:quote.data,step:4});
     await queryClient.invalidateQueries({queryKey:['twipay','event-orders']});
   }catch{setError('Payment outcome is not confirmed. Review your orders before attempting a new checkout. Your original attempt has been preserved.');}
   finally{setPin('');locked.current=false;setBusy(false);}
 }
 async function reviewExisting(){
   if(!pending||busy)return;
   setBusy(true);setError('');setCheckedStatus(null);
   try{
     const status=await getCheckoutIntentStatus(pending.key);
     setCheckedStatus(status.status);
     if(status.reference){
       const order=await getEventOrder(status.reference);
       if(order){const updated={...pending,reference:order.reference};savePending(updated);setPending(updated);update({order,step:4});return;}
     }
     if(status.status==='NOT_FOUND')setError('We couldn’t find a completed payment request. You can retry this booking with the same details.');
     else if(status.status==='FAILED')setError('This checkout failed or was rejected. Do not retry it as a new payment until you have reviewed your wallet and orders.');
     else setError('This checkout is pending or uncertain. Do not start a different payment. Check the status again later.');
   }catch{setError('Unable to check the existing checkout. Do not start another payment.');}
   finally{setBusy(false);}
 }
 function newAttempt(){
   if(!pending||!['NOT_FOUND','FAILED','PAID','REFUNDED'].includes(checkedStatus||'')) {setError('Check the original checkout status before starting another booking.');return;}
   if(!window.confirm('Start a DIFFERENT booking? First verify the old transaction in your wallet and event orders. A pending payment can still complete.'))return;
   sessionStorage.removeItem(storageKey);setPending(null);setCheckedStatus(null);setError('');setPin('');setAck(false);update({step:1,quote:null,order:null});
 }
 return <section className="w-full max-w-[390px] mx-auto flex flex-col justify-center min-h-full"><BackButton action={()=>update({step:2})} className="mb-8"/><h1 className="text-[#112929] font-medium text-2xl">Confirm purchase</h1><p className="text-[#717171] mt-2">Review the exact event order price before checkout.</p>
 {quote.isPending&&<p className="mt-6 text-[#667085]" role="status">Calculating price…</p>}
 {quote.isError&&<p className="mt-6 text-red-600" role="alert">Could not obtain a valid ticket quote. Return to event selection.</p>}
 {quote.data&&<div className="w-full border-t-2 border-b-2 border-[#F0F2F5] my-7 py-7 text-sm text-[#475367] flex flex-col gap-4">
   <div className="flex justify-between gap-3"><span>Ticket quantity</span><span>{quantity}</span></div>
   <div className="flex justify-between gap-3"><span>Ticket cost</span><span>{formatNgnMinorUnits(quote.data.subtotalMinor)}</span></div>
   <div className="flex justify-between gap-3"><span>Platform fee</span><span>{formatNgnMinorUnits(quote.data.platformFeeMinor)}</span></div>
   <div className="flex justify-between gap-3 font-semibold"><span>Total wallet debit</span><span>{formatNgnMinorUnits(quote.data.totalMinor)}</span></div>
   <p>Ticket holder: {recipientName}</p><p className="text-xs text-[#667085]">Your total and ticket availability will be checked again before payment.</p>
 </div>}
 {sandbox&&quote.data&&<div className="space-y-3 text-sm mt-3"><label htmlFor="event-transaction-pin" className="block text-[#344054] font-medium">Transaction PIN</label><input id="event-transaction-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={pin} onChange={event=>setPin(event.target.value.replace(/\D/g,'').slice(0,4))} className="w-full rounded-lg border border-[#D0D5DD] p-3" placeholder="4-digit PIN"/><label className="flex items-start gap-2 text-[#475467]"><input type="checkbox" checked={ack} onChange={event=>setAck(event.target.checked)}/><span>I have reviewed my tickets, total cost and wallet debit. A pending payment must be checked before retrying.</span></label></div>}
 {!sandbox&&<p role="status" className="text-amber-700 text-sm mt-5">Ticket payments are temporarily unavailable. You can still explore events and view your bookings.</p>}
 {pending&&<div className="text-sm mt-5 p-3 rounded-md bg-amber-50 text-amber-900"><p>There is an earlier checkout attempt. Do not submit a different payment without checking its status.</p>{pending.reference&&<p>Reference: {pending.reference}</p>}
  <button type="button" className="underline mt-2 block" onClick={reviewExisting} disabled={busy}>Check original checkout status</button>
  <button type="button" className="underline block mt-2" onClick={newAttempt} disabled={busy}>Review and start a different booking</button></div>}
 {error&&<p role="alert" className="text-red-600 mt-4 text-sm">{error}</p>}
 <CustomButton className="w-full mt-6" disabled={!canSubmit} onClick={onCheckout}>{busy?'Submitting…':pending?'Retry identical checkout':'Confirm wallet payment'}</CustomButton>
 </section>;
}
