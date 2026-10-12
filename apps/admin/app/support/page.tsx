"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {OpsShell} from '../_components/ops-shell';
import {Fail} from '../_components/state';
import {opsGet,opsMutation} from '../_lib/api';
type Summary={reference:string;subject:string;category:string;status:string;createdAt:string;updatedAt:string};
type DisputeSummary={reference:string;status:string;category:string;reasonCode:string;openedAt:string};
type Detail=Summary&{messages:{id:string;authorType:string;text:string;createdAt:string}[]};
/** No message bodies, document attachments, or credentials are stored in localStorage. */
export default function SupportOperationsPage(){
 const [disputes,setDisputes]=useState<DisputeSummary[]>([]);const [disputesUnavailable,setDisputesUnavailable]=useState(false);
 const [items,setItems]=useState<Summary[]>([]);const [selected,setSelected]=useState<Detail|null>(null);
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [reply,setReply]=useState('');const [notice,setNotice]=useState('');
 const requestKey=useRef<string|null>(null);const locked=useRef(false);
 async function load(){try{const res=await opsGet<{cases:Summary[]}>('/operations/support/cases');setItems(res.cases);setError('');}catch(cause:any){setError(cause.code??'REQUEST_FAILED');}}
 useEffect(()=>{void load();void opsGet<{disputes:DisputeSummary[]}>('/operations/disputes').then(v=>setDisputes(v.disputes)).catch(()=>setDisputesUnavailable(true));},[]);
 async function select(reference:string){setSelected(null);setNotice('');setReply('');requestKey.current=null;try{const result=await opsGet<{case:Detail}>(`/operations/support/cases/${reference}`);setSelected(result.case);}catch(cause:any){setNotice(cause.code??'ACCESS_DENIED');}}
 async function submit(e:FormEvent){e.preventDefault();if(!selected||locked.current)return;locked.current=true;setBusy(true);setNotice('');requestKey.current??=crypto.randomUUID();try{await opsMutation(`/operations/support/cases/${selected.reference}/replies`,{message:reply.trim(),requestKey:requestKey.current});requestKey.current=null;setReply('');setNotice('Reply saved. The customer may receive a separate delivery notification.');await select(selected.reference);await load();}catch(cause:any){setNotice(cause.code??'REPLY_NOT_CONFIRMED');}finally{locked.current=false;setBusy(false);}}
 async function close(){if(!selected||locked.current)return;locked.current=true;setBusy(true);setNotice('');try{await opsMutation(`/operations/support/cases/${selected.reference}/close`);setNotice('Case closed.');await load();setSelected(null);}catch(cause:any){setNotice(cause.code??'CLOSE_BLOCKED');}finally{locked.current=false;setBusy(false);}}
 return <OpsShell title="Customer support"><div className="ops-note warning"><strong>Restricted customer information</strong><span>Only authorized staff with recent MFA may access conversations or reply. Never request passwords, PINs, verification codes, or identity documents. Support cannot initiate refunds or change ledger records.</span></div>
  {error?<Fail code={error}/>:<section className="ops-panel"><h2>Open requests</h2>{!items.length?<p>No open support cases.</p>:<div className="table"><div className="tr th"><span>Reference</span><span>Subject</span><span>Status</span><span>Action</span></div>{items.map(item=><div className="tr" key={item.reference}><span>{item.reference}</span><span>{item.subject}</span><span>{item.status}</span><span><button onClick={()=>void select(item.reference)}>Review</button></span></div>)}</div>}</section>}
  <section className="ops-panel"><h2>Financial dispute review (read only)</h2><p className="small">These cases remain under the existing financial dispute and refund controls. Responding to a general support ticket does not authorize a refund, reversal or ledger change.</p>
   {disputesUnavailable?<p className="small">Financial dispute review is unavailable or your account lacks permission.</p>:!disputes.length?<p className="small">No open financial disputes are available to you.</p>:<div className="table"><div className="tr th"><span>Reference</span><span>Category</span><span>Status</span><span>Reason</span></div>{disputes.map(d=><div className="tr" key={d.reference}><span>{d.reference}</span><span>{d.category}</span><span>{d.status}</span><span>{d.reasonCode}</span></div>)}</div>}
  </section>
  {selected&&<section className="ops-panel"><h2>{selected.subject}</h2><p className="small">{selected.category} · {selected.reference} · {selected.status}</p>{selected.messages.map(m=><div key={m.id} className="ops-note" style={{marginTop:12,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}><strong>{m.authorType==='STAFF'?'Support team':'Customer'} · {new Date(m.createdAt).toLocaleString('en-NG')}</strong><span>{m.text}</span></div>)}
   {selected.status!=='CLOSED'&&<form onSubmit={submit} style={{marginTop:16}}><label htmlFor="support-response">Reply to customer</label><textarea id="support-response" rows={4} style={{display:'block',width:'100%',marginTop:8}} maxLength={3000} minLength={2} required value={reply} onChange={e=>{setReply(e.target.value);requestKey.current=null;}}/><p className="small">Private content is encrypted at rest. Attachments are not accepted.</p><button disabled={busy} type="submit">Send reply</button> <button disabled={busy} className="secondary" type="button" onClick={()=>void close()}>Close case</button></form>}
  </section>}
  {notice&&<p role="status" className="small">{notice}</p>}
 </OpsShell>;
}
