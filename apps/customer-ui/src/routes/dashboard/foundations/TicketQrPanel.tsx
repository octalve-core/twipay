import {useCallback,useEffect,useRef,useState} from 'react';
import QRCode from 'qrcode';
import {retrieveTicketCredential} from '@/lib/api/dashboard-apis/ticketAccess';

/** Show a signed bearer credential only after the customer explicitly requests it. */
export default function TicketQrPanel({reference,publicCode}:{reference:string;publicCode:string}){
 const [qr,setQr]=useState<string|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const currentRequest=useRef(0);
 const hide=useCallback(()=>{currentRequest.current++;setQr(null);setError('');setBusy(false);},[]);
 useEffect(()=>{
  if(!qr)return;
  const timeout=window.setTimeout(hide,60_000);
  const onVisibility=()=>{if(document.hidden)hide();};
  const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')hide();};
  document.addEventListener('visibilitychange',onVisibility);
  document.addEventListener('keydown',onKey);
  return ()=>{window.clearTimeout(timeout);document.removeEventListener('visibilitychange',onVisibility);document.removeEventListener('keydown',onKey);};
 },[qr,hide]);
 useEffect(()=>()=>{currentRequest.current++;},[]);
 async function show(){
  if(busy)return;
  const request=++currentRequest.current;
  setBusy(true);setError('');
  try{
   const credential=await retrieveTicketCredential(reference,publicCode);
   const image=await QRCode.toDataURL(credential,{errorCorrectionLevel:'H',margin:3,width:360,color:{dark:'#112929',light:'#ffffff'}});
   if(request===currentRequest.current)setQr(image);
  }catch{
   if(request===currentRequest.current)setError('Your admission QR is not available right now. Check your ticket status and try again.');
  }finally{if(request===currentRequest.current)setBusy(false);}
 }
 if(import.meta.env.VITE_TWIPAY_EVENT_QR_SANDBOX_ENABLED!=='true')return <p className="text-xs text-[#667085] mt-2">Secure QR admission is not available yet.</p>;
 return <div className="mt-2">
  <button type="button" onClick={show} disabled={busy||!!qr} className="rounded-lg border border-[#112929] text-[#112929] px-3 py-2 text-sm disabled:opacity-50">{busy?'Preparing ticket…':'Show admission QR'}</button>
  {error&&<p className="text-red-700 text-sm mt-2" role="alert">{error}</p>}
  {qr&&<div role="dialog" aria-modal="true" aria-label="Admission QR code" className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
   <div className="max-w-sm w-full rounded-xl bg-white p-5 text-center shadow-lg">
    <h3 className="text-lg font-semibold text-[#112929]">Your admission ticket</h3>
    <p className="mt-2 text-sm text-[#667085]">Present this code to authorized event staff. It hides automatically after one minute.</p>
    <img src={qr} alt="Scannable admission QR credential" className="mx-auto my-4 w-full max-w-[300px]" draggable={false}/>
    <p className="text-xs text-[#475467]">Ticket {publicCode}</p>
    <button type="button" onClick={hide} className="mt-4 rounded-lg bg-[#112929] text-white px-5 py-2">Hide ticket</button>
   </div>
  </div>}
 </div>;
}
