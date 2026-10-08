import api from '../axios';
import { readEvent, readEventList, readEventOrder, readEventQuote, isEventId, isEventReference, type EventQuote, type EventOrder } from './eventContracts';
export type {PublishedEvent, EventTicket, EventOrder, EventQuote} from './eventContracts';
export async function listPublishedEvents() {const {data}=await api.get('/events');return readEventList(data);}
export async function getPublishedEvent(slug:string) {if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw new TypeError('Invalid event slug');const {data}=await api.get(`/events/${slug}`);if(!data?.event)return null;return readEvent(data.event);}
export async function quoteEventOrder(eventId:string,ticketTypeId:string,quantity:number):Promise<EventQuote> {
  if(!isEventId(eventId)||!isEventId(ticketTypeId)||!Number.isInteger(quantity)||quantity<1||quantity>20)throw new TypeError('Invalid ticket selection');
  const {data}=await api.post('/events/quote',{eventId,items:[{ticketTypeId,quantity}]});return readEventQuote(data,{eventId,ticketTypeId,quantity});
}
export async function checkoutEvent(quote:EventQuote,name:string,key:string):Promise<EventOrder> {
  if(import.meta.env.VITE_TWIPAY_EVENT_CHECKOUT_SANDBOX_ENABLED!=='true')throw new Error('Event checkout is not enabled');
  if(!/^twipay-event:[0-9a-f-]{36}$/.test(key)||name.trim().length<2||name.trim().length>180)throw new TypeError('Invalid event purchase request');
  const {data}=await api.post('/events/checkout',{eventId:quote.eventId,items:quote.items,issuedToName:name.trim(),expectedTotalMinor:quote.totalMinor},{headers:{'Idempotency-Key':key}});
  const order=readEventOrder(data);if(order.totalMinor!==quote.totalMinor)throw new TypeError('Unexpected checkout total');return order;
}
export async function listEventOrders():Promise<EventOrder[]> {const {data}=await api.get('/events/orders');if(!Array.isArray(data?.orders)||data.orders.length>100)throw new TypeError('Invalid order history');return data.orders.map(readEventOrder);}
export async function getEventOrder(reference:string):Promise<EventOrder|null> {if(!isEventReference(reference))throw new TypeError('Invalid order reference');const {data}=await api.get(`/events/orders/${encodeURIComponent(reference)}`);return data?.order?readEventOrder(data.order):null;}

export type CheckoutIntentStatus={status:string;reference?:string};
export async function getCheckoutIntentStatus(key:string):Promise<CheckoutIntentStatus> {
  if(!/^twipay-event:[0-9a-f-]{36}$/.test(key))throw new TypeError('Invalid ticket intent');
  const {data}=await api.get(`/events/checkout-intents/${key}`);
  const intent=data?.intent;
  if(!intent||typeof intent.status!=='string'||!['NOT_FOUND','PROCESSING','FAILED','UNKNOWN','PAID','FUNDS_RESERVED','CREATED','REFUNDED'].includes(intent.status)||
    (intent.reference!==undefined&&!isEventReference(intent.reference)))throw new TypeError('Unexpected checkout intent response');
  return {status:intent.status,...(intent.reference?{reference:intent.reference}:{})};
}
