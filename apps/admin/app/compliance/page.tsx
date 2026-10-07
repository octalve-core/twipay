"use client";
import {useEffect,useState} from 'react';
import {OpsShell} from '../_components/ops-shell';
import {Fail,Wait} from '../_components/state';
import {opsGet,money} from '../_lib/api';

export default function Compliance(){
  const[data,setData]=useState<any>();
  const[error,setError]=useState('');
  useEffect(()=>{opsGet<any>('/operations/compliance').then(setData).catch(x=>setError(x.code||'REQUEST_FAILED'))},[]);
  return <OpsShell title="Compliance & identity review">{error?<Fail code={error}/>:!data?<Wait/>:<>
    <div className="ops-note"><strong>Data minimization</strong><span>This view exposes status, consent metadata and masked identity digits only. BVN/NIN ciphertext and raw provider responses are not returned.</span></div>
    <section className="ops-panel"><h2>Identity verification queue</h2><div className="table"><div className="tr th"><span>User</span><span>Type</span><span>Status</span><span>Provider / consent</span></div>{data.identity.verifications.map((v:any)=><div className="tr" key={v.id}><span>{v.user.email}<small>{v.user.givenName||''} {v.user.familyName||''}</small></span><span>{v.type}<small>••••{v.identifierLast4||'—'}</small></span><span>{v.status}</span><span>{v.providerCode}<small>{new Date(v.consentRecordedAt).toLocaleString()}</small></span></div>)}</div></section>
    <section className="ops-panel"><h2>Recent disputes</h2><div className="table"><div className="tr th"><span>Reference</span><span>User</span><span>Status</span><span>Transaction</span></div>{data.disputes.cases.map((d:any)=><div className="tr" key={d.reference}><span>{d.reference}<small>{d.category} · {d.reasonCode}</small></span><span>{d.user.email}</span><span>{d.status}</span><span>{d.financialTransaction.reference}<small>{money(d.financialTransaction.amountMinor,d.financialTransaction.currency)} · {d.financialTransaction.status}</small></span></div>)}</div></section>
  </>}</OpsShell>;
}
