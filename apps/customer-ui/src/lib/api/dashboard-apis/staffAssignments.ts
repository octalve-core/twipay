/** Owner-only organizer staff API; never use staff assignments as payout permissions. */
import api from '../axios';
import {isEventId} from './eventContracts';
export type EventStaff={id:string;eventId:string;userId:string;email:string;role:'CHECK_IN';status:'ACTIVE'|'REVOKED'};
const email=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function readEventStaff(raw:unknown,eventId:string):EventStaff[]{
 const records=(raw as {assignments?:unknown}|null)?.assignments;
 if(!isEventId(eventId)||!Array.isArray(records)||records.length>100)throw new TypeError('Invalid event staff response');
 return records.map(rawItem=>{
  if(!rawItem||typeof rawItem!=='object')throw new TypeError('Invalid event staff assignment');
  const item=rawItem as Record<string,unknown>;const user=item.user as Record<string,unknown>|null;
  if(!user||!isEventId(String(item.id))||item.eventId!==eventId||!isEventId(String(item.userId))||item.role!=='CHECK_IN'||!['ACTIVE','REVOKED'].includes(String(item.status))||typeof user.email!=='string'||!email.test(user.email)||user.email.length>320)throw new TypeError('Invalid event staff assignment');
  return {id:item.id as string,eventId,userId:item.userId as string,email:user.email,role:'CHECK_IN',status:item.status as EventStaff['status']};
 });
}
export async function listEventStaff(eventId:string):Promise<EventStaff[]>{
 if(!isEventId(eventId))throw new TypeError('Invalid event');
 const {data}=await api.get(`/events/${eventId}/staff`);return readEventStaff(data,eventId);
}
export async function inviteEventCheckInStaff(eventId:string,staffEmail:string):Promise<void>{
 const normalized=staffEmail.trim().toLowerCase();
 if(!isEventId(eventId)||normalized.length>320||!email.test(normalized))throw new TypeError('Enter a valid email address');
 await api.post(`/events/${eventId}/staff`,{email:normalized});
}
export async function revokeEventCheckInStaff(eventId:string,assignmentId:string):Promise<void>{
 if(!isEventId(eventId)||!isEventId(assignmentId))throw new TypeError('Invalid assignment');
 await api.delete(`/events/${eventId}/staff/${assignmentId}`);
}
