import {useState,type FormEvent} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {inviteEventCheckInStaff,listEventStaff,revokeEventCheckInStaff} from '@/lib/api/dashboard-apis/staffAssignments';
import { brand } from "@/config/brand";

/** Organizer-scoped delegation; payout and financial privileges are never granted here. */
export default function EventStaffManagement({eventId,eventTitle}:{eventId:string;eventTitle:string}){
 const client=useQueryClient();const [email,setEmail]=useState('');const [error,setError]=useState('');const [notice,setNotice]=useState('');
 const query=useQuery({queryKey:['twipay','event-staff',eventId],queryFn:()=>listEventStaff(eventId),retry:false});
 const change=useMutation({mutationFn:async(task:()=>Promise<void>)=>task(),onSuccess:async()=>{setEmail('');setError('');setNotice('Check-in staff settings saved.');await client.invalidateQueries({queryKey:['twipay','event-staff',eventId]});},onError:()=>{setNotice('');setError('We could not update this staff assignment. Check the account and try again.');}});
 function invite(event:FormEvent){event.preventDefault();if(!change.isPending){setError('');setNotice('');change.mutate(()=>inviteEventCheckInStaff(eventId,email));}}
 return <div className="mt-3 border-t border-[#F0F2F5] pt-4">
  <h4 className="font-medium text-[#112929]">Check-in staff · {eventTitle}</h4>
  <p className="mt-1 text-xs text-[#667085]">Invite an existing {brand.name} customer with a verified email. This grants admission-checking access only, not payments or payouts. Live check-in remains unavailable.</p>
  <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={invite}>
   <div className="min-w-[200px] flex-1"><label htmlFor={`staff-email-${eventId}`} className="block text-sm text-[#344054]">Staff email</label><input id={`staff-email-${eventId}`} className="mt-1 w-full rounded-lg border border-[#D0D5DD] p-3 text-sm" type="email" autoComplete="off" maxLength={320} required value={email} onChange={e=>setEmail(e.target.value)}/></div>
   <button type="submit" className="rounded-lg bg-[#112929] px-4 py-3 text-white text-sm disabled:opacity-50" disabled={change.isPending||!email.trim()}>Assign check-in access</button>
  </form>
  {query.isPending&&<p role="status" className="mt-3 text-sm text-[#667085]">Loading staff…</p>}
  {query.isError&&<p role="alert" className="mt-3 text-red-700 text-sm">Staff assignments could not be loaded.</p>}
  {query.data?.map(staff=><div key={staff.id} className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-[#F9FAFB] p-3"><div><p className="text-sm text-[#344054] break-all">{staff.email}</p><p className="text-xs text-[#667085]">{staff.status==='ACTIVE'?'Active check-in assignment':'Access revoked'}</p></div>{staff.status==='ACTIVE'&&<button type="button" disabled={change.isPending} onClick={()=>{setError('');change.mutate(()=>revokeEventCheckInStaff(eventId,staff.id));}} className="rounded-lg border border-[#D0D5DD] px-3 py-2 text-sm text-[#344054] disabled:opacity-50">Revoke</button>}</div>)}
  {error&&<p role="alert" className="mt-3 text-red-700 text-sm">{error}</p>}{notice&&<p role="status" className="mt-3 text-[#112929] text-sm">{notice}</p>}
 </div>;
}
