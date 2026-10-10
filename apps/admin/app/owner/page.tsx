"use client";
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {OpsShell} from '../_components/ops-shell';
import {Fail,Wait} from '../_components/state';
import {opsGet,money} from '../_lib/api';
export default function OwnerOverview(){
 const[data,setData]=useState<any>();const[risk,setRisk]=useState<any>();const[riskError,setRiskError]=useState('');const[error,setError]=useState('');
 useEffect(()=>{opsGet<any>('/operations/owner/overview').then(setData).catch(e=>setError(e.code||'REQUEST_FAILED'));opsGet<any>('/operations/owner/risk').then(setRisk).catch(e=>setRiskError(e.code||'REQUEST_FAILED'))},[]);
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
   <section className="ops-panel"><h2>Operational risk, provider health and ticketing</h2>
    {riskError?<p role="alert">Risk summary unavailable: {riskError}</p>:!risk?<p>Loading independently observed risk data…</p>:<>
     <p className="small">Observed period: {new Date(risk.period.from).toLocaleString()} to {new Date(risk.period.to).toLocaleString()}. Counts are not a provider SLA or revenue confirmation.</p>
     <div className="ops-metrics"><article><span>Provider operations · failed/unknown</span><strong>{risk.providerOutcomes.filter((r:any)=>['FAILED','UNKNOWN'].includes(r.status)).reduce((n:number,r:any)=>n+r.count,0)}</strong></article>
     <article><span>Non-closed provider circuits</span><strong>{risk.providerCircuits.filter((r:any)=>r.circuitState!=='CLOSED').length}</strong></article>
     <article><span>Check-ins in period</span><strong>{risk.tickets.checkInsInPeriod}</strong></article>
     <article><span>Pending owner approvals</span><strong>{risk.pendingOwnerReviews.staff+risk.pendingOwnerReviews.customerSuspensions}</strong></article></div>
     <div className="table"><div className="tr th"><span>Provider</span><span>Capability</span><span>Observed circuit</span><span>Last failure</span></div>
      {risk.providerCircuits.map((p:any)=><div className="tr" key={`${p.providerCode}:${p.capability}`}><span>{p.providerCode}</span><span>{p.capability}</span><span>{p.circuitState}</span><span>{p.lastFailureAt?new Date(p.lastFailureAt).toLocaleString():'None recorded'}</span></div>)}</div>
     <p className="small">Tickets by state: {risk.tickets.byStatus.map((t:any)=>`${t.status} ${t.count}`).join(' · ')||'No observed tickets'}. Draft events: {risk.tickets.draftEvents}.</p>
     <p className="small">Security events over the period: {risk.securityEvents.map((r:any)=>`${r.type} ${r.count}`).join(' · ')||'None observed'}. Owner audit actions: {risk.ownerAuditActionsInPeriod}.</p>
    </>}</section>
   <section className="ops-panel"><h2>Operations shortcuts</h2><div className="actions-inline">
    <Link href="/owner/customers">Customer directory</Link><Link href="/owner/staff">Staff approvals</Link>
    <Link href="/exceptions">Financial exceptions</Link><Link href="/financial-tiers">Financial tiers</Link><Link href="/refunds">Refund reviews</Link><Link href="/payouts">Organizer payouts</Link><Link href="/providers">Providers</Link><Link href="/reports">Reports</Link><Link href="/config">Configuration</Link><Link href="/support">Support queue</Link><Link href="/audit">Audit events</Link></div></section>
  </>}
 </OpsShell>;
}
