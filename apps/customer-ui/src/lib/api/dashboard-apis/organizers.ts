import api from '../axios';
export type OrganizerSummary={id:string;name:string;slug:string;status:'ACTIVE'|'SUSPENDED'|'CLOSED';eventCount:number};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const slug=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Owner-scoped organizer summary; intentionally does not import settlement or payout fields. */
export function readMyOrganizers(raw:unknown):OrganizerSummary[]{
 if(!raw||typeof raw!=='object'||!Array.isArray((raw as Record<string,unknown>).organizers))throw new TypeError('Unexpected organizer response');
 const list=(raw as {organizers:unknown[]}).organizers;
 if(list.length>50)throw new TypeError('Unexpected organizer count');
 return list.map(entry=>{
  if(!entry||typeof entry!=='object'||Array.isArray(entry))throw new TypeError('Unexpected organizer record');
  const v=entry as Record<string,unknown>;
  if(typeof v.id!=='string'||!uuid.test(v.id)||typeof v.name!=='string'||v.name.length<1||v.name.length>180||typeof v.slug!=='string'||!slug.test(v.slug)||v.slug.length>120||!['ACTIVE','SUSPENDED','CLOSED'].includes(String(v.status))||typeof v.eventCount!=='number'||!Number.isSafeInteger(v.eventCount)||v.eventCount<0)throw new TypeError('Unexpected organizer data');
  return {id:v.id,name:v.name,slug:v.slug,status:v.status as OrganizerSummary['status'],eventCount:v.eventCount};
 });
}
export async function listMyOrganizers():Promise<OrganizerSummary[]>{const {data}=await api.get('/events/organizers/me');return readMyOrganizers(data);}
