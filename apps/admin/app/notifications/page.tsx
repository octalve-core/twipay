"use client";
import {useEffect,useState} from 'react';
import {OpsShell} from '../_components/ops-shell';
import {opsGet} from '../_lib/api';
type Summary={counts:{status:string;suppressed:boolean;count:number}[]};
/** No customer-specific inbox contents, subjects, destinations, or decrypt operations. */
export default function NotificationOperationsPage(){
 const [summary,setSummary]=useState<Summary|null>(null);const [error,setError]=useState('');
 async function refresh(){try{const result=await opsGet<Summary>('/operations/notifications/delivery-summary');setSummary(result);setError('');}catch(cause:any){setError(cause.code??'ACCESS_DENIED');setSummary(null);}}
 useEffect(()=>{void refresh();},[]);
 return <OpsShell title="Notification delivery health"><div className="ops-note warning"><strong>Aggregated delivery outcomes only</strong><span>This view contains no customer names, destinations, message bodies, inbox contents or credentials. Recent MFA and a dedicated permission are required.</span></div>
  <section className="ops-panel"><h2>Delivery outcomes</h2><p className="small">Provider acceptance is not proof that a customer received or read a message. Suppressed optional support emails are not sent.</p><button type="button" onClick={()=>void refresh()}>Refresh summary</button>
  {error&&<p role="alert">Unable to read delivery health ({error}).</p>}{!summary&&!error&&<p role="status">Loading delivery health…</p>}
  {summary&&<div className="table"><div className="tr th"><span>Provider state</span><span>Preference suppression</span><span>Count</span><span>Scope</span></div>{summary.counts.map(row=><div className="tr" key={`${row.status}-${row.suppressed}`}><span>{row.status}</span><span>{row.suppressed?'Skipped':'Not suppressed'}</span><span>{row.count}</span><span>Aggregate only</span></div>)}</div>}
  </section></OpsShell>;
}
