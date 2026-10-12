"use client";
import { useEffect, useState } from 'react';
import { OpsShell } from '../_components/ops-shell';
import { Fail, Wait } from '../_components/state';
import { money, opsGet, opsMutation } from '../_lib/api';

type Case = { id:string; type:string; status:string; summary:string; createdAt:string;
  prepared:boolean; preparedBy:string|null; financial:null|{ reference:string;status:string;type:string;
  amountMinor:string;feeMinor:string;currency:string;holds:{id:string;status:string}[] };
  provider:null|{providerCode:string;status:string;type:string} };
type Hold = {id:string;reference:string;transactionStatus:string;status:string;amountMinor:string;currency:string;createdAt:string;expiresAt:string|null};
type Queue = { cases:Case[];activeHolds:Hold[];bounded:boolean };
export default function FinancialExceptionsPage() {
  const [data,setData]=useState<Queue>();const [error,setError]=useState('');const [message,setMessage]=useState('');
  async function load(){try{setData(await opsGet<Queue>('/operations/financial-exceptions'));setError('')}catch(cause:any){setError(cause.code??'REQUEST_FAILED')}}
  useEffect(()=>{void load()},[]);
  async function prepare(id:string){
    const note=window.prompt('Record factual review evidence (no bank numbers, customer secrets or PINs), minimum 20 characters:');
    if(!note||note.trim().length<20)return;
    try{await opsMutation(`/operations/financial-exceptions/${id}/prepare`,{note});setMessage('Review prepared. An independent checker is required.');await load()}
    catch(cause:any){setMessage(cause.code??'PREPARE_BLOCKED')}
  }
  async function close(id:string){
    if(!window.confirm('Only matched, terminal provider and ledger evidence can be closed. This does not release funds or change transaction status. Continue?'))return;
    try{await opsMutation(`/operations/financial-exceptions/${id}/close-verified-status`);setMessage('Verified status review closed without changing funds.');await load()}
    catch(cause:any){setMessage(cause.code??'CLOSURE_BLOCKED')}
  }
  return <OpsShell title="Financial exceptions">
    <div className="ops-note warning"><strong>Review only</strong><span>Unknown provider outcomes, disputed credits, and active holds must remain unsettled until independently verified. Review actions never credit wallets, release holds, submit payouts, or rewrite ledger entries.</span></div>
    {error?<Fail code={error}/>:!data?<Wait/>:<>
      <section className="ops-panel"><h2>Reconciliation cases (oldest first, up to 100)</h2>
        <div className="table"><div className="tr th"><span>Case</span><span>Transaction</span><span>Evidence state</span><span>Restricted actions</span></div>
          {data.cases.map(item=><div className="tr" key={item.id}>
            <span><strong>{item.type}</strong><small>{item.summary}</small><small>{new Date(item.createdAt).toLocaleString()}</small></span>
            <span>{item.financial?.reference??'No linked transaction'}<small>{item.financial?`${money(item.financial.amountMinor,item.financial.currency)} · ${item.financial.type}`:'Unlinked case'}</small></span>
            <span>{item.financial?.status??'Unknown'} / {item.provider?.status??'Unknown'}<small>Active holds: {item.financial?.holds.filter(h=>h.status==='ACTIVE').length??0}</small><small>{item.prepared?'Prepared for checker':'Not prepared'}</small></span>
            <span className="actions-inline">{!item.prepared&&<button onClick={()=>prepare(item.id)}>Prepare review</button>}{item.prepared&&<button onClick={()=>close(item.id)}>Check verified status</button>}</span>
          </div>)}
        </div>{data.cases.length===0&&<p className="small">No open reconciliation cases in this bounded view.</p>}</section>
      <section className="ops-panel"><h2>Active wallet holds (up to 100)</h2>
        <div className="table compact"><div className="tr th"><span>Transaction</span><span>Amount held</span><span>Transaction status</span><span>Created</span></div>
        {data.activeHolds.map(h=><div className="tr" key={h.id}><span>{h.reference}</span><span>{money(h.amountMinor,h.currency)}</span><span>{h.transactionStatus}</span><span>{new Date(h.createdAt).toLocaleString()}</span></div>)}
        </div>{data.activeHolds.length===0&&<p className="small">No active holds matched this bounded review.</p>}</section>
      {message&&<p className="small" role="status">{message}</p>}
    </>}
  </OpsShell>;
}
