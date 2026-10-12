"use client";
import {FormEvent,useEffect,useState} from 'react';
import {OpsShell} from '../../_components/ops-shell';
import {Fail,Wait} from '../../_components/state';
import {opsGet,opsMutation} from '../../_lib/api';
interface Suspension {id:string;targetUserId:string;reason:string;preparedByUserId:string;createdAt:string}
interface Activity {userId:string;status:string;period:{from:string;to:string};transactions:{type:string;status:string;count:number}[];supportCases:{status:string;count:number}[];eventOrders:{status:string;count:number}[];securityEventCount:number;recentTransactions:{id:string;type:string;status:string;createdAt:string}[];recentSupport:{reference:string;status:string;createdAt:string}[]}
interface Customer { id:string;emailMasked:string;status:string;contactVerified:boolean;createdAt:string;financialEligibility:string;kycTier:number }
export default function OwnerCustomers(){
 const [activity,setActivity]=useState<Activity>();const [activityError,setActivityError]=useState('');
 const [data,setData]=useState<Customer[]>();const [reviews,setReviews]=useState<Suspension[]>([]);const [message,setMessage]=useState('');const [error,setError]=useState('');const [search,setSearch]=useState('');
 async function load(query=''){try{const d=await opsGet<{customers:Customer[]}>(`/operations/owner/customers${query?`?search=${encodeURIComponent(query)}`:''}`);setData(d.customers);setError('')}catch(e:any){setError(e.code||'REQUEST_FAILED')}}
 async function loadReviews(){try{setReviews((await opsGet<{reviews:Suspension[]}>('/operations/owner/customers/suspensions')).reviews)}catch(e:any){setError(e.code||'REQUEST_FAILED')}}
 useEffect(()=>{void load();void loadReviews()},[]);
 async function showActivity(id:string){setActivity(undefined);setActivityError('');try{setActivity(await opsGet<Activity>(`/operations/owner/customers/${encodeURIComponent(id)}/activity`))}catch(e:any){setActivityError(e.code||'ACTIVITY_UNAVAILABLE')}}
 function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();void load(search.trim())}
 async function prepare(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);try{
  await opsMutation('/operations/owner/customers/suspensions',{targetUserId:String(f.get('targetUserId')),reason:String(f.get('reason'))});
  setMessage('Suspension proposal recorded. A different owner must approve it.');await loadReviews();
 }catch(err:any){setMessage(err.code||'ACTION_DENIED')}}
 async function decide(id:string,decision:'approve'|'reject'){const reason=decision==='reject'?window.prompt('Independent reason for rejection (20–500 characters)'):undefined;
  if(decision==='reject'&&!reason)return;try{await opsMutation(`/operations/owner/customers/suspensions/${id}/${decision}`,decision==='reject'?{reason}:{});
   setMessage(`Decision ${decision} recorded.`);await loadReviews();await load(search.trim());
  }catch(err:any){setMessage(err.code||'ACTION_DENIED')}}
 return <OpsShell title="Customer oversight">
  <div className="ops-note"><strong>Privacy first</strong><span>Bounded 40-record snapshot or exact email/UUID lookup. Contact details are masked. This page cannot view identity documents, change limits or move funds.</span></div>
  <section className="ops-panel"><h2>Find a customer</h2><form className="ops-form" onSubmit={submit}><label>Exact email or customer UUID<input value={search} maxLength={320} onChange={e=>setSearch(e.target.value)} placeholder="Exact email or UUID"/></label><div className="actions-inline"><button type="submit">Search securely</button><button type="button" className="secondary" onClick={()=>{setSearch('');void load()}}>Latest 40</button></div></form></section>
  <section className="ops-panel"><h2>Review customer account restriction</h2>
   <p className="small">Suspension is a high-impact access restriction, subject to an independent owner approval. It does not change the customer wallet or transactions. Restoration is outside this batch.</p>
   <form className="ops-form" onSubmit={prepare}><label>Customer UUID<input name="targetUserId" required maxLength={36} pattern="[0-9a-fA-F-]{36}"/></label>
    <label>Reason and evidence summary (20–500 characters)<input name="reason" minLength={20} maxLength={500} required/></label>
    <button type="submit">Prepare suspension for review</button></form></section>
  <section className="ops-panel"><h2>Pending customer suspensions</h2>
   {reviews.length===0?<p className="small">No pending suspension proposals.</p>:<div className="table"><div className="tr th"><span>Customer ID</span><span>Maker</span><span>Evidence</span><span>Independent check</span></div>
    {reviews.map(r=><div className="tr" key={r.id}><span>{r.targetUserId}</span><span>{r.preparedByUserId}</span><span>{r.reason}</span>
     <span><div className="actions-inline"><button type="button" onClick={()=>void decide(r.id,'approve')}>Approve</button><button type="button" className="secondary" onClick={()=>void decide(r.id,'reject')}>Reject</button></div></span></div>)}</div>}</section>
  {activityError&&<section className="ops-panel danger"><p role="alert">{activityError}</p></section>}
  {activity&&<section className="ops-panel"><h2>Observed activity — {activity.userId}</h2><p className="small">{new Date(activity.period.from).toLocaleString()} to {new Date(activity.period.to).toLocaleString()}. {activity.status}. No raw amounts, customer messages or identity documents.</p>
   <p>Transactions: {activity.transactions.map(x=>`${x.type}/${x.status}: ${x.count}`).join(' · ')||'None observed'}</p>
   <p>Support: {activity.supportCases.map(x=>`${x.status}: ${x.count}`).join(' · ')||'None observed'}</p>
   <p>Event orders: {activity.eventOrders.map(x=>`${x.status}: ${x.count}`).join(' · ')||'None observed'}</p>
   <p>Security events: {activity.securityEventCount}</p>
   <div className="table"><div className="tr th"><span>Transaction UUID</span><span>Type</span><span>Status</span><span>Created</span></div>
    {activity.recentTransactions.map(x=><div className="tr" key={x.id}><span>{x.id}</span><span>{x.type}</span><span>{x.status}</span><span>{new Date(x.createdAt).toLocaleString()}</span></div>)}
   </div>
   <h3>Recent support references (no message content)</h3>
   {activity.recentSupport.map(x=><p key={x.reference}>{x.reference} · {x.status} · {new Date(x.createdAt).toLocaleString()}</p>)}
  </section>}
  {message&&<section className="ops-panel"><p>{message}</p></section>}
  {error?<Fail code={error}/>:!data?<Wait/>:<section className="ops-panel"><h2>Customer records · {data.length}</h2>
   <div className="table"><div className="tr th"><span>Masked email / reference</span><span>Status</span><span>Contact</span><span>Financial policy</span></div>
   {data.map(c=><div className="tr" key={c.id}><span>{c.emailMasked}<small>{c.id}</small><button type="button" className="secondary" onClick={()=>void showActivity(c.id)}>View aggregate activity</button></span><span>{c.status}</span><span>{c.contactVerified?'Verified':'Unverified'}</span><span>{c.financialEligibility}<small>Tier {c.kycTier} · {new Date(c.createdAt).toLocaleDateString()}</small></span></div>)}</div></section>}
 </OpsShell>;
}
