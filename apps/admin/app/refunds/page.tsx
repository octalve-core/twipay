"use client";

import { useEffect, useState } from 'react';
import { OpsShell } from '../_components/ops-shell';
import { Fail, Wait } from '../_components/state';
import { money, opsGet, opsMutation } from '../_lib/api';

export default function RefundsPage() {
  const [data, setData] = useState<any>();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function load() { try { setData(await opsGet<any>('/operations/refunds')); setError(''); } catch (cause: any) { setError(cause.code ?? 'REQUEST_FAILED'); } }
  useEffect(() => { void load(); }, []);

  async function prepare(reference: string) {
    const note = window.prompt('Review note for the independent checker:');
    if (!note || note.trim().length < 5) return;
    try { await opsMutation(`/operations/refunds/${reference}/prepare`, { note }); setMessage(`${reference}: prepared for independent approval`); await load(); }
    catch (cause: any) { setMessage(cause.code ?? 'PREPARE_BLOCKED'); }
  }

  async function reject(reference: string) {
    const reason = window.prompt('Reason for rejecting this refund request?');
    if (!reason || reason.trim().length < 5) return;
    try { await opsMutation(`/operations/refunds/${reference}/reject`, { reason }); setMessage(`${reference}: rejected`); await load(); }
    catch (cause: any) { setMessage(cause.code ?? 'REJECTION_BLOCKED'); }
  }

  async function approve(reference: string) {
    try { await opsMutation(`/operations/refunds/${reference}/approve`); setMessage(`${reference}: compensating refund submitted`); await load(); }
    catch (cause: any) { setMessage(cause.code ?? 'APPROVAL_BLOCKED'); }
  }

  return <OpsShell title="Refunds & disputes">{error ? <Fail code={error}/> : !data ? <Wait/> : <>
    <div className="ops-note warning"><strong>Fail closed</strong><span>Event refunds are disabled by default. When enabled, approval still requires a different checker with recent MFA and posts a compensating journal; the original purchase journal is never edited.</span></div>
    <section className="ops-panel"><div className="table"><div className="tr th"><span>Reference</span><span>Status</span><span>Amount</span><span>Action</span></div>{data.refunds.map((refund:any)=><div className="tr" key={refund.reference}><span>{refund.reference}</span><span>{refund.status}</span><span>{money(refund.amountMinor,refund.currency)}</span><span className="actions-inline">{refund.status==='REQUESTED'&&<><button onClick={()=>prepare(refund.reference)}>Prepare</button><button className="secondary" onClick={()=>reject(refund.reference)}>Reject</button></>}{refund.status==='UNDER_REVIEW'&&<><button onClick={()=>approve(refund.reference)}>Approve</button><button className="secondary" onClick={()=>reject(refund.reference)}>Reject</button></>}</span></div>)}</div>{message&&<p className="small">{message}</p>}</section>
  </>}</OpsShell>;
}
