import api from '../axios';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const slug=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Phase 5.1: all mutating organizer routes are authenticated and owner-derived on the API. */
export type ManagedEvent={id:string;organizerId:string;title:string;slug:string;status:'DRAFT'|'PUBLISHED'|'SALES_PAUSED'|'SOLD_OUT'|'CANCELLED'|'COMPLETED';startsAt:string;ticketTypes:Array<{id:string;name:string;priceMinor:string;capacity:number;status:string}>;orderCount:number};
const money=/^[1-9]\d{0,17}$/;
const statuses=['DRAFT','PUBLISHED','SALES_PAUSED','SOLD_OUT','CANCELLED','COMPLETED'];
function obj(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v))throw new TypeError('Invalid organizer response');return v as Record<string,unknown>;}
export function readManagedEvents(raw:unknown,organizerId:string):ManagedEvent[]{
 const events=obj(raw).events;
 if(!uuid.test(organizerId)||!Array.isArray(events)||events.length>100)throw new TypeError('Invalid organizer event list');
 return events.map(item=>{
  const v=obj(item);
  if(typeof v.id!=='string'||!uuid.test(v.id)||v.organizerId!==organizerId||typeof v.title!=='string'||!v.title.trim()||v.title.length>220||typeof v.slug!=='string'||!slug.test(v.slug)||!statuses.includes(String(v.status))||typeof v.startsAt!=='string'||!Number.isFinite(Date.parse(v.startsAt))||!Number.isSafeInteger(v.orderCount)||Number(v.orderCount)<0||!Array.isArray(v.ticketTypes)||v.ticketTypes.length>100)throw new TypeError('Invalid organizer event');
  const ticketTypes=v.ticketTypes.map(rawTicket=>{const t=obj(rawTicket);if(typeof t.id!=='string'||!uuid.test(t.id)||typeof t.name!=='string'||!t.name.trim()||t.name.length>160||typeof t.priceMinor!=='string'||!money.test(t.priceMinor)||typeof t.capacity!=='number'||!Number.isSafeInteger(t.capacity)||t.capacity<1||typeof t.status!=='string'||!['ACTIVE','PAUSED','SOLD_OUT','CLOSED'].includes(t.status))throw new TypeError('Invalid organizer ticket type');return {id:t.id,name:t.name,priceMinor:t.priceMinor,capacity:t.capacity,status:t.status};});
  return {id:v.id,title:v.title,slug:v.slug,organizerId,status:v.status as ManagedEvent['status'],startsAt:v.startsAt,ticketTypes,orderCount:v.orderCount as number};
 });
}
export async function createMyOrganizer(name:string,organizerSlug:string):Promise<void>{
 if(name.trim().length<2||name.trim().length>180||organizerSlug.length>120||!slug.test(organizerSlug))throw new TypeError('Check organizer name and slug');
 await api.post('/events/organizers',{name:name.trim(),slug:organizerSlug});
}
export async function listManagedEvents(organizerId:string):Promise<ManagedEvent[]>{
 if(!uuid.test(organizerId))throw new TypeError('Invalid organizer selection');
 const {data}=await api.get(`/events/organizers/${organizerId}/events`);
 return readManagedEvents(data,organizerId);
}
export async function createEventDraft(input:{organizerId:string;title:string;slug:string;startsAt:string;venueName?:string}):Promise<void>{
 if(!uuid.test(input.organizerId)||input.title.trim().length<3||input.title.trim().length>220||!slug.test(input.slug)||input.slug.length>160||!Number.isFinite(Date.parse(input.startsAt))||Date.parse(input.startsAt)<=Date.now()||input.venueName && input.venueName.length>220)throw new TypeError('Check the event details');
 await api.post('/events',{organizerId:input.organizerId,title:input.title.trim(),slug:input.slug,startsAt:input.startsAt,...(input.venueName?{venueName:input.venueName.trim()}:{})});
}
export async function addEventTicketType(eventId:string,name:string,priceMinor:string,capacity:number):Promise<void>{
 if(!uuid.test(eventId)||name.trim().length<2||name.trim().length>160||!money.test(priceMinor)||!Number.isSafeInteger(capacity)||capacity<1||capacity>1_000_000)throw new TypeError('Check the ticket details');
 await api.post(`/events/${eventId}/ticket-types`,{name:name.trim(),priceMinor,capacity});
}
export async function publishManagedEvent(eventId:string):Promise<void>{
 if(import.meta.env.VITE_TWIPAY_EVENT_ORGANIZER_SANDBOX_ENABLED!=='true')throw new Error('Event publishing is not available');
 if(!uuid.test(eventId))throw new TypeError('Invalid event selection');
 await api.post(`/events/${eventId}/publish`,{});
}
