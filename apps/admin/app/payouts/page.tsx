"use client";

import { useEffect, useState } from 'react';
import { OpsShell } from '../_components/ops-shell';
import { Fail, Wait } from '../_components/state';
import { money, opsGet, opsMutation } from '../_lib/api';

export default function PayoutsPage() {
  const [data, setData] = useState<any>();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function load() { try { setData(await opsGet<any>('/operations/payouts')); setError(''); } catch (cause: any) { setError(cause.code ?? 'REQUEST_FAILED'); } }
  useEffect(() => { void load(); }, []);

  async function act(reference: string, action: 'prepare'|'approve'|'reconcile') {
    try { await opsMutation(`/operations/payouts/${reference}/${action}`); setMessage(`${reference}: ${action} submitted`); await load(); }
    catch (cause: any) { setMessage(cause.code ?? 'ACTION_BLOCKED'); }
  }

  async function reject(reference: string) {
    const reason = window.prompt('Reason for rejecting this organizer payout request?');
    if (!reason || reason.trim().length < 5) return;
    try { await opsMutation(`/operations/payouts/${reference}/reject`, { reason }); setMessage(`${reference}: rejected`); await load(); }
    catch (cause: any) { setMessage(cause.code ?? 'REJECTION_BLOCKED'); }
  }

  return <OpsShell title="Organizer payouts">{error ? <Fail code={error}/> : !data ? <Wait/> : <>
    <div className="ops-note warning"><strong>Maker/checker</strong><span>Payouts are disabled by default. A different MFA-satisfied checker must approve money leaving TwiPay. UNKNOWN provider outcomes retain the settlement reservation until same-provider reconciliation.</span></div>
    <section className="ops-panel"><div className="table"><div className="tr th"><span>Organizer</span><span>Status</span><span>Beneficiary</span><span>Amount / action</span></div>{data.payouts.map((p:any)=><div className="tr" key={p.reference}><span>{p.organizer.name}<small>{p.reference}</small></span><span>{p.status}</span><span>{p.beneficiary.accountName}<small>•••• {p.beneficiary.accountNumberLast4}</small></span><span>{money(p.amountMinor,p.currency)}<div className="actions-inline">{p.status==='REQUESTED'&&<button onClick={()=>act(p.reference,'prepare')}>Prepare</button>}{['REQUESTED','PENDING_APPROVAL'].includes(p.status)&&<button className="secondary" onClick={()=>reject(p.reference)}>Reject</button>}{p.status==='PENDING_APPROVAL'&&<button onClick={()=>act(p.reference,'approve')}>Approve</button>}{['PROCESSING','UNKNOWN','PROVIDER_SUBMITTED'].includes(p.status)&&<button onClick={()=>act(p.reference,'reconcile')}>Reconcile</button>}</div></span></div>)}</div>{message&&<p className="small">{message}</p>}</section>
  </>}</OpsShell>;
}
