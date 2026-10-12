/** Strict client boundary for TwiPay events; never use legacy dummy event pricing. */
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const integer = /^(0|[1-9]\d{0,18})$/;
const reference = /^[A-Za-z0-9._:-]{1,100}$/;
export type EventTicket = {id:string;name:string;priceMinor:string;currency:string;status:string;capacity:number};
export type PublishedEvent = {id:string;slug:string;title:string;description:string|null;status:string;venueName:string|null;venueAddress:string|null;startsAt:string;endsAt:string|null;organizer:{name:string;slug:string};ticketTypes:EventTicket[]};
export type EventQuote = {eventId:string;currency:'NGN';subtotalMinor:string;platformFeeMinor:string;totalMinor:string;items:Array<{ticketTypeId:string;quantity:number}>};
export type EventOrder = {reference:string;status:string;currency:string;subtotalMinor:string;platformFeeMinor:string;totalMinor:string;eventTitle?:string;event?:{title:string;slug:string;startsAt:string;venueName:string|null}; tickets:Array<{publicCode:string;status?:string;ticketType?:string}>};
function record(raw:unknown):Record<string,unknown> {if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new TypeError('Invalid TwiPay event response');return raw as Record<string,unknown>;}
function str(raw:unknown,max=220):string {if(typeof raw!=='string'||!raw.trim()||raw.length>max)throw new TypeError('Invalid TwiPay event string');return raw;}
function amount(raw:unknown):string {if(typeof raw!=='string'||!integer.test(raw)||BigInt(raw)>9_223_372_036_854_775_807n)throw new TypeError('Invalid TwiPay event amount');return raw;}
function optional(raw:unknown,max=10000):string|null {return raw===undefined||raw===null?null:str(raw,max);}
export function readEvent(raw:unknown):PublishedEvent {
  const v=record(raw), org=record(v.organizer);
  if(!uuid.test(str(v.id,36))||!['PUBLISHED','SOLD_OUT'].includes(str(v.status,25))||!Number.isFinite(Date.parse(str(v.startsAt,80)))||!Array.isArray(v.ticketTypes))throw new TypeError('Invalid published event');
  const ticketTypes=v.ticketTypes.map((rawTicket:unknown)=>{const t=record(rawTicket); if(!uuid.test(str(t.id,36))||!Number.isInteger(t.capacity)||Number(t.capacity)<1||str(t.currency,3)!=='NGN')throw new TypeError('Invalid event ticket');return {id:t.id as string,name:str(t.name,160),priceMinor:amount(t.priceMinor),currency:'NGN',status:str(t.status,25),capacity:t.capacity as number};});
  return {id:v.id as string,slug:str(v.slug,160),title:str(v.title),description:optional(v.description),status:v.status as string,venueName:optional(v.venueName,220),venueAddress:optional(v.venueAddress,500),startsAt:v.startsAt as string,endsAt:optional(v.endsAt,80),organizer:{name:str(org.name,180),slug:str(org.slug,160)},ticketTypes};
}
export function readEventList(raw:unknown):PublishedEvent[] {const events=record(raw).events;if(!Array.isArray(events)||events.length>100)throw new TypeError('Invalid events list');return events.map(readEvent);}
export function readEventQuote(raw:unknown,expected:{eventId:string;ticketTypeId:string;quantity:number}):EventQuote {
  const v=record(record(raw).quote);
  if(v.eventId!==expected.eventId||v.currency!=='NGN'||!Array.isArray(v.items)||v.items.length!==1)throw new TypeError('Invalid quote identity');
  const item=record(v.items[0]);if(item.ticketTypeId!==expected.ticketTypeId||item.quantity!==expected.quantity)throw new TypeError('Invalid quote items');
  const subtotalMinor=amount(v.subtotalMinor),platformFeeMinor=amount(v.platformFeeMinor),totalMinor=amount(v.totalMinor);
  if(BigInt(subtotalMinor)+BigInt(platformFeeMinor)!==BigInt(totalMinor)||BigInt(totalMinor)<=0n)throw new TypeError('Invalid quote total');
  return {eventId:expected.eventId,currency:'NGN',subtotalMinor,platformFeeMinor,totalMinor,items:[{ticketTypeId:expected.ticketTypeId,quantity:expected.quantity}]};
}
export function readEventOrder(raw:unknown):EventOrder {
  const v=record(raw);const ref=str(v.reference,100);
  if(!reference.test(ref)||v.currency!=='NGN'||!['PAID','CREATED','FUNDS_RESERVED','PENDING','PROCESSING','UNKNOWN','FAILED','CANCELLED','REFUNDED'].includes(str(v.status,40))||!Array.isArray(v.tickets))throw new TypeError('Invalid event order');
  const subtotalMinor=amount(v.subtotalMinor),platformFeeMinor=amount(v.platformFeeMinor),totalMinor=amount(v.totalMinor);
  if(BigInt(subtotalMinor)+BigInt(platformFeeMinor)!==BigInt(totalMinor))throw new TypeError('Invalid event order total');
  const tickets=v.tickets.map((rawTicket:unknown)=>{const t=record(rawTicket);return {publicCode:str(t.publicCode,100),...(typeof t.status==='string'?{status:str(t.status,30)}:{}),...(typeof t.ticketType==='string'?{ticketType:str(t.ticketType,160)}:{})};});
  // Never accept/copy qrPayload into persistent client state, analytics or storage.
  const evt=v.event===undefined?undefined:record(v.event);
  return {reference:ref,status:v.status as string,currency:'NGN',subtotalMinor,platformFeeMinor,totalMinor,tickets,
    ...(typeof v.eventTitle==='string'?{eventTitle:str(v.eventTitle)}:{}),
    ...(evt?{event:{title:str(evt.title),slug:str(evt.slug,160),startsAt:str(evt.startsAt,80),venueName:optional(evt.venueName,220)}}:{})};
}
export function isEventReference(value:string):boolean {return reference.test(value);}
export function isEventId(value:string):boolean {return uuid.test(value);}
