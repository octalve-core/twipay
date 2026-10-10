"use client";
import {FormEvent,useEffect,useState} from 'react';
import {OpsShell} from '../../_components/ops-shell';
import {opsGet,opsMutation} from '../../_lib/api';
interface Review{id:string;targetUserId:string;roleCode:string;action:string;reason:string;preparedByUserId:string;createdAt:string}
interface Member{userId:string;emailMasked:string;role:string;status:string}
const roles=['SUPPORT_AGENT','AUDITOR','COMPLIANCE'] as const;
export default function StaffGovernance(){
 const[staff,setStaff]=useState<Member[]>([]);const[reviews,setReviews]=useState<Review[]>([]);const[error,setError]=useState('');const[msg,setMsg]=useState('');const[loading,setLoading]=useState(true);
 async function load(){try{const[s,r]=await Promise.all([opsGet<{staff:Member[]}>('/operations/owner/staff'),opsGet<{reviews:Review[]}>('/operations/owner/staff/reviews')]);setStaff(s.staff);setReviews(r.reviews);setError('')}catch(e:any){setError(e.code||'REQUEST_FAILED')}finally{setLoading(false)}}
 useEffect(()=>{void load()},[]);
 async function prepare(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);setMsg('');try{await opsMutation('/operations/owner/staff/reviews',{targetUserId:String(f.get('targetUserId')),roleCode:String(f.get('roleCode')),action:String(f.get('action')),reason:String(f.get('reason'))});setMsg('Proposal recorded. A different owner must approve it.');await load()}catch(e:any){setMsg(e.code||'ACTION_DENIED')}}
 async function decide(id:string,decision:'approve'|'reject'){const reason=decision==='reject'?window.prompt('Explain the rejection (20–500 characters):'):undefined;if(decision==='reject'&&!reason)return;try{await opsMutation(`/operations/owner/staff/reviews/${id}/${decision}`,decision==='reject'?{reason}:{});setMsg(`Independent review ${decision} recorded.`);await load()}catch(e:any){setMsg(e.code||'ACTION_DENIED')}}
 return <OpsShell title="Staff governance">
  <div className="ops-note warning"><strong>Two-person control</strong><span>Each change is proposed by one owner and checked by another with recent MFA. Only support, audit and compliance roles can be delegated. No owner/finance/provider role can be granted here. Changes are disabled in production until qualified.</span></div>
  {error&&<section className="ops-panel danger"><p>{error}</p></section>}
  <section className="ops-panel"><h2>Prepare access change</h2><form className="ops-form" onSubmit={prepare}>
   <label>Verified, active customer UUID<input name="targetUserId" required maxLength={36} pattern="[0-9a-fA-F-]{36}"/></label>
   <label>Role<select name="roleCode">{roles.map(role=><option key={role}>{role}</option>)}</select></label>
   <label>Action<select name="action"><option value="GRANT">Grant limited staff role</option><option value="REVOKE">Revoke staff role</option></select></label>
   <label>Reason (20–500 characters)<input name="reason" required minLength={20} maxLength={500}/></label>
   <button type="submit">Prepare for independent approval</button></form></section>
  <section className="ops-panel"><h2>Pending independent approvals</h2>{loading?<p>Loading…</p>:reviews.length===0?<p>No pending reviews.</p>:<div className="table"><div className="tr th"><span>Target</span><span>Role</span><span>Action</span><span>Review</span></div>
   {reviews.map(r=><div className="tr" key={r.id}><span>{r.targetUserId}<small>{r.reason}</small></span><span>{r.roleCode}</span><span>{r.action}<small>Maker: {r.preparedByUserId}</small></span><span><div className="actions-inline"><button onClick={()=>void decide(r.id,'approve')}>Approve</button><button className="secondary" onClick={()=>void decide(r.id,'reject')}>Reject</button></div></span></div>)}</div>}</section>
  <section className="ops-panel"><h2>Current staff and owners · bounded</h2><div className="table"><div className="tr th"><span>Masked email</span><span>Role</span><span>Account</span><span>Customer ID</span></div>
   {staff.map(s=><div className="tr" key={`${s.userId}:${s.role}`}><span>{s.emailMasked}</span><span>{s.role}</span><span>{s.status}</span><span>{s.userId}</span></div>)}</div></section>
  {msg&&<section className="ops-panel"><p>{msg}</p></section>}
 </OpsShell>;
}
