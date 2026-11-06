import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {useQuery} from '@tanstack/react-query';
import {FoundationPage,FoundationPanel,FoundationUnavailable} from '@/components/design-system/ErhaFoundationUI';
import {checkInTicket,listCheckInEvents,type CheckInResult} from '@/lib/api/dashboard-apis/ticketAccess';
import { brand } from "@/config/brand";

const field='w-full rounded-lg border border-[#D0D5DD] p-3 text-sm text-[#344054] focus-visible:outline-2 focus-visible:outline-[#112929]';
const action='rounded-lg bg-[#112929] px-5 py-3 text-sm font-medium text-white disabled:opacity-50';

type Decoder={detect(source:HTMLVideoElement):Promise<Array<{rawValue:string}>>};
type DetectorConstructor=new (options:{formats:string[]})=>Decoder;
function barcodeDetector():DetectorConstructor|undefined {
 return (window as Window & {BarcodeDetector?:DetectorConstructor}).BarcodeDetector;
}
/** Scanning is local; neither camera frames nor credentials are sent anywhere except the protected check-in endpoint. */
export default function EventCheckIn(){
 const enabled=import.meta.env.VITE_TWIPAY_EVENT_QR_SANDBOX_ENABLED==='true';
 const events=useQuery({queryKey:['twipay','staff-event-assignments'],queryFn:listCheckInEvents,enabled,retry:false});
 const [raw,setRaw]=useState('');const [selected,setSelected]=useState('');
 const [result,setResult]=useState<CheckInResult|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const [cameraOn,setCameraOn]=useState(false);
 const video=useRef<HTMLVideoElement|null>(null);const stream=useRef<MediaStream|null>(null);const raf=useRef<number|null>(null);
 const cameraActive=useRef(false);const submitting=useRef(false);
 const stopCamera=useCallback(()=>{
  cameraActive.current=false;
  if(raf.current!==null)cancelAnimationFrame(raf.current);
  raf.current=null;
  stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;
  if(video.current)video.current.srcObject=null;
  setCameraOn(false);
 },[]);
 useEffect(()=>()=>{cameraActive.current=false;if(raf.current!==null)cancelAnimationFrame(raf.current);stream.current?.getTracks().forEach(track=>track.stop());},[]);
 const eventId=events.data?.some(event=>event.id===selected)?selected:events.data?.[0]?.id??'';
 const submitPayload=useCallback(async(payload:string)=>{
  if(submitting.current||!eventId)return;
  submitting.current=true;stopCamera();setBusy(true);setResult(null);setError('');setRaw('');
  try{
   // Never reuse a request ID as a substitute for the ticket's single-use admission policy.
   const response=await checkInTicket(eventId,payload,crypto.randomUUID());
   setResult(response);
  }catch{setError('Unable to admit this ticket. It may be invalid, already used, cancelled, or outside your assigned event. Check with the organizer.');}
  finally{submitting.current=false;setBusy(false);}
 },[stopCamera,eventId]);
 async function startCamera(){
  if(!eventId||busy||cameraActive.current)return;
  const Detector=barcodeDetector();
  if(!Detector||!navigator.mediaDevices?.getUserMedia){setError('Camera scanning is not supported here. Use a connected QR scanner instead.');return;}
  setError('');
  try{
   const media=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'}}});
   stream.current=media;cameraActive.current=true;setCameraOn(true);
   if(!video.current){stopCamera();return;}
   video.current.srcObject=media;await video.current.play();
   const detector=new Detector({formats:['qr_code']});
   const scan=async()=>{
    if(!cameraActive.current||!video.current)return;
    try{
     const observations=await detector.detect(video.current);
     const value=observations.find(item=>item.rawValue.startsWith('twipay-ticket:v1:'))?.rawValue;
     if(value){stopCamera();void submitPayload(value);return;}
    }catch{stopCamera();setError('Camera scanning stopped. Use a connected QR scanner instead.');return;}
    if(cameraActive.current)raf.current=requestAnimationFrame(()=>void scan());
   };
   raf.current=requestAnimationFrame(()=>void scan());
  }catch{stopCamera();setError('Camera permission was not granted or the camera is unavailable. Use a connected QR scanner instead.');}
 }
 function submit(event:FormEvent){event.preventDefault();if(!eventId||busy)return;void submitPayload(raw.trim());}
 return <FoundationPage title="Event check-in" description="Only authorized organizer owners and check-in staff can admit tickets.">
  {!enabled?<FoundationUnavailable title="Ticket check-in" description="Event admission is not available yet."/>:
  <FoundationPanel title="Verify admission" description="A scanned ticket is checked securely against its event, purchase and admission status.">
   {events.isPending&&<p role="status" className="text-[#667085] mt-3 text-sm">Loading your event assignments…</p>}
   {events.isError&&<p role="alert" className="text-red-700 mt-3 text-sm">Your event assignments could not be loaded.</p>}
   {events.data?.length===0&&<p className="text-[#667085] mt-3 text-sm">You do not have any active event check-in assignments.</p>}
   {!!events.data?.length&&<>
    <label htmlFor="staff-event" className="mt-4 block text-sm font-medium text-[#344054]">Assigned event</label>
    <select id="staff-event" className={`${field} mt-2`} value={eventId} onChange={e=>{setSelected(e.target.value);setResult(null);setError('');stopCamera();}}>
     {events.data.map(item=><option key={item.id} value={item.id}>{item.title} — {new Date(item.startsAt).toLocaleDateString()}</option>)}
    </select>
    <form className="mt-5 space-y-3" onSubmit={submit}>
     <label htmlFor="scan-ticket" className="block text-sm font-medium text-[#344054]">Scan admission code</label>
     <input id="scan-ticket" className={field} type="text" autoComplete="off" spellCheck={false} value={raw} onChange={e=>setRaw(e.target.value.slice(0,300))} placeholder="Scan using a connected QR scanner" required maxLength={300}/>
     <p className="text-xs text-[#667085]">Your QR scanner can enter the code here. Never share or save a visitor's entrance code.</p>
     <button className={action} type="submit" disabled={busy||raw.trim().length<60}>{busy?'Checking…':'Verify and check in'}</button>
    </form>
    {barcodeDetector()&&<div className="mt-5"><button type="button" onClick={()=>cameraOn?stopCamera():void startCamera()} disabled={busy} className="rounded-lg border border-[#112929] px-4 py-2 text-sm text-[#112929]">{cameraOn?'Stop camera':'Scan with camera'}</button></div>}
    <video ref={video} aria-label="QR camera preview" playsInline muted className={cameraOn?'mt-4 w-full max-w-sm rounded-lg border border-[#D0D5DD]':'hidden'}/>
   </>}
   {error&&<p role="alert" className="text-red-700 mt-4 text-sm">{error}</p>}
   {result&&<div role="status" className="mt-4 rounded-lg border border-[#D0D5DD] bg-[#F9FAFB] p-4"><p className="font-medium text-[#112929]">Admission confirmed by {brand.name}</p><p className="text-sm text-[#344054] mt-1">{result.eventTitle} · {result.ticketType}</p><p className="text-xs text-[#667085] mt-1">Ticket {result.publicCode} · {new Date(result.checkedInAt).toLocaleString()}</p></div>}
  </FoundationPanel>}
 </FoundationPage>;
}
