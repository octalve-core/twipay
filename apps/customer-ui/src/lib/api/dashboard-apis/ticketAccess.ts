/** Phase 5.2: sensitive ticket data is intentionally never cached in React Query or browser storage. */
import api from '../axios';
import {isEventId,isEventReference} from './eventContracts';

const publicCodePattern=/^TWP-[A-Za-z0-9_-]{8,100}$/;
const credentialPattern=/^twipay-ticket:v1:[A-Za-z0-9_-]{8,100}:[A-Za-z0-9_-]{40,80}$/;
const allowedEventStatus=new Set(['PUBLISHED','SOLD_OUT']);
const text=(value:unknown,length:number):string=>{
 if(typeof value!=='string'||value.length<1||value.length>length)throw new TypeError('Invalid ticket service response');
 return value;
};
export function readTicketCredential(raw:unknown,expectedCode:string):string {
 if(!raw||typeof raw!=='object')throw new TypeError('Invalid ticket response');
 const t=(raw as {ticket?:unknown}).ticket;
 if(!t||typeof t!=='object')throw new TypeError('Invalid ticket response');
 const ticket=t as Record<string,unknown>;
 const code=text(ticket.publicCode,100);
 const payload=text(ticket.qrPayload,300);
 if(code!==expectedCode||ticket.status!=='ACTIVE'||!credentialPattern.test(payload)||payload.split(':')[2]!==code)throw new TypeError('Invalid active ticket credential');
 return payload;
}
/** The only caller is an explicit customer action; disable HTTP and browser caching at the API. */
export async function retrieveTicketCredential(reference:string,publicCode:string):Promise<string> {
 if(!isEventReference(reference)||!publicCodePattern.test(publicCode))throw new TypeError('Invalid ticket reference');
 const {data}=await api.get(`/events/orders/${encodeURIComponent(reference)}/tickets/${encodeURIComponent(publicCode)}/credential`,{headers:{'Cache-Control':'no-store'}});
 return readTicketCredential(data,publicCode);
}
export type StaffEvent={id:string;title:string;startsAt:string;venueName:string|null;status:'PUBLISHED'|'SOLD_OUT'};
export function readCheckInEvents(raw:unknown):StaffEvent[] {
 const value=raw as {events?:unknown}|null;
 if(!value||!Array.isArray(value.events)||value.events.length>100)throw new TypeError('Invalid staff event response');
 return value.events.map(entry=>{
  if(!entry||typeof entry!=='object')throw new TypeError('Invalid staff event');
  const v=entry as Record<string,unknown>;
  const id=text(v.id,36),title=text(v.title,220),startsAt=text(v.startsAt,80);
  if(!isEventId(id)||!Number.isFinite(Date.parse(startsAt))||!allowedEventStatus.has(String(v.status))||!(v.venueName===null||typeof v.venueName==='string'&&v.venueName.length<=220))throw new TypeError('Invalid staff event');
  return {id,title,startsAt,venueName:v.venueName as string|null,status:v.status as StaffEvent['status']};
 });
}
export async function listCheckInEvents():Promise<StaffEvent[]> {
 const {data}=await api.get('/events/tickets/check-in/assignments');
 return readCheckInEvents(data);
}
export type CheckInResult={eventId:string;publicCode:string;status:'CHECKED_IN';checkedInAt:string;ticketType:string;eventTitle:string};
export function readCheckInResult(raw:unknown):CheckInResult {
 const data=raw as {ticket?:unknown}|null;
 if(!data?.ticket||typeof data.ticket!=='object')throw new TypeError('Invalid check-in response');
 const v=data.ticket as Record<string,unknown>;
 const code=text(v.publicCode,100),checkedInAt=text(v.checkedInAt,80),eventId=text(v.eventId,36);
 if(!isEventId(eventId)||!publicCodePattern.test(code)||v.status!=='CHECKED_IN'||!Number.isFinite(Date.parse(checkedInAt)))throw new TypeError('Invalid check-in confirmation');
 return {eventId,publicCode:code,status:'CHECKED_IN',checkedInAt,ticketType:text(v.ticketType,160),eventTitle:text(v.eventTitle,220)};
}
export async function checkInTicket(eventId:string,qrPayload:string,requestId:string):Promise<CheckInResult> {
 if(!isEventId(eventId)||!credentialPattern.test(qrPayload)||!isEventId(requestId))throw new TypeError('Invalid scan');
 const {data}=await api.post('/events/tickets/check-in',{eventId,qrPayload,requestId});
 const result=readCheckInResult(data);if(result.eventId!==eventId)throw new TypeError('Mismatched check-in event');return result;
}
