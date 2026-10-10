"use client";
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {OpsShell} from '../_components/ops-shell';
import {Fail,Wait} from '../_components/state';
import {opsGet,money} from '../_lib/api';
export default function OwnerOverview(){
 const[data,setData]=useState<any>();const[error,setError]=useState('');
 useEffect(()=>{opsGet<any>('/operations/owner/overview').then(setData).catch(e=>setError(e.code||'REQUEST_FAILED'))},[]);
 const report=data?.operations;
 return <OpsShell title="Owner control centre">
  <div className="ops-note warning"><strong>Operational evidence only</strong><span>All figures are observed backend records, not live settlements or launch authorization. Sensitive staff actions require independent owner approval and recent MFA.</span></div>
  {error?<Fail code={error}/>:!data?<Wait/>:<>
   <section className="ops-metrics"><article><span>Registered customers</span><strong>{report.users}</strong></article>
    <article><span>Open disputes</span><strong>{report.queues.openDisputes}</strong></article>
    <article><span>Reconciliation cases</span><strong>{report.queues.openReconciliation}</strong></article>
    <article><span>Open support</span><strong>{data.openSupportCases}</strong></article></section>
   <section className="ops-panel"><h2>Account status</h2><p className="small">Snapshot, not an assertion of transaction eligibility.</p>
    <div className="ops-facts">{data.customersByStatus.map((s:any)=><div key={s.status}><dt>{s.status}</dt><dd>{s.count}</dd></div>)}</div></section>
   <section className="ops-panel"><h2>Financial activity · last 30 days</h2>
    <p className="small">{new Date(report.period.from).toLocaleString()} to {new Date(report.period.to).toLocaleString()}. Statuses must never be interpreted as final settlement without reconciliation.</p>
    <div className="table"><div className="tr th"><span>Type</span><span>Status</span><span>Count</span><span>Observed amount</span></div>
    {report.transactions.map((r:any)=><div className="tr" key={`${r.type}-${r.status}`}><span>{r.type}</span><span>{r.status}</span><span>{r.count}</span><span>{money(r.amountMinor)}</span></div>)}</div></section>
   <section className="ops-panel"><h2>Operations shortcuts</h2><div className="actions-inline">
    <Link href="/owner/customers">Customer directory</Link><Link href="/owner/staff">Staff approvals</Link>
    <Link href="/exceptions">Financial exceptions</Link><Link href="/support">Support queue</Link><Link href="/audit">Audit events</Link></div></section>
  </>}
 </OpsShell>;
}
