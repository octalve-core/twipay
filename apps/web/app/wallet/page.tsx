"use client";
import { FormEvent,useEffect,useState } from 'react';
import { AppShell } from '../_components/app-shell';
import { apiGet,apiMutation,formatMinor,parseNgnMajorToMinor } from '../_lib/api';
import { ErrorCard,LoadingCard } from '../_components/load-state';

export default function Wallet(){
  const [data,setData]=useState<any>();
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  async function load(){
    try{
      const [w,v,t]=await Promise.all([apiGet<any>('/wallets'),apiGet<any>('/virtual-accounts'),apiGet<any>('/transactions')]);
      setData({w,v,t});setError('');
    }catch(e:any){setError(e.code||'REQUEST_FAILED')}
  }
  useEffect(()=>{void load()},[]);
  async function fund(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const f=new FormData(e.currentTarget);
    try{
      const r=await apiMutation<any>('/payments/collections','POST',{provider:String(f.get('provider')),amountMinor:parseNgnMajorToMinor(String(f.get('amount'))),currency:'NGN'},{idempotent:true});
      setMessage(`Payment created: ${r.reference||r.transaction?.reference||'continue with provider'}`);await load();
    }catch(x:any){setMessage(x.code||'Unable to create funding request')}
  }
  async function transfer(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const f=new FormData(e.currentTarget);
    const provider=String(f.get('provider'));const bankCode=String(f.get('bankCode')).trim();const accountNumber=String(f.get('accountNumber')).trim();
    try{
      const resolved=await apiMutation<any>('/transfers/resolve-account','POST',{provider,bankCode,accountNumber,currency:'NGN'});
      const approved=window.confirm(`Send ${String(f.get('amount'))} NGN to ${resolved.account.accountName} (${resolved.account.accountNumber})?`);
      if(!approved){setMessage('Transfer cancelled before submission.');return;}
      const r=await apiMutation<any>('/transfers','POST',{provider,bankCode,accountNumber,currency:'NGN',amountMinor:parseNgnMajorToMinor(String(f.get('amount'))),narration:String(f.get('narration')).trim()},{idempotent:true});
      setMessage(`Transfer ${r.transaction?.reference||r.reference||''}: ${r.transaction?.status||r.status||'submitted'}`);await load();
    }catch(x:any){setMessage(x.code||'Unable to submit transfer')}
  }
  async function provision(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const f=new FormData(e.currentTarget);const provider=String(f.get('provider'));
    const body:any={provider,consent:true};
    const preferredBank=String(f.get('preferredBank')||'').trim();if(preferredBank)body.preferredBank=preferredBank;
    if(provider==='paystack'){
      body.validationBankCode=String(f.get('validationBankCode')||'').trim();
      body.validationAccountNumber=String(f.get('validationAccountNumber')||'').trim();
    }
    try{const r=await apiMutation<any>('/virtual-accounts','POST',body,{idempotent:true});setMessage(`Virtual account: ${r.status||r.virtualAccount?.status||'provisioning'}`);await load()}catch(x:any){setMessage(x.code||'Unable to provision virtual account')}
  }
  return <AppShell title="Wallet" subtitle="Ledger-backed NGN wallet with transparent holds, secure transfers and funding accounts.">
    {error?<ErrorCard message={error}/>:!data?<LoadingCard/>:<>
      <section className="metric-grid"><article className="metric primary"><span>Available</span><strong>{formatMinor(data.w.wallet.availableBalanceMinor)}</strong><small>Posted {formatMinor(data.w.wallet.postedBalanceMinor)}</small></article><article className="metric"><span>Reserved</span><strong>{formatMinor(data.w.wallet.activeHoldsMinor)}</strong><small>Pending operations</small></article><article className="metric"><span>Virtual accounts</span><strong>{data.v.virtualAccounts.length}</strong><small>Assigned funding accounts</small></article></section>
      <div className="two-col">
        <section className="panel"><h2>Fund wallet</h2><form className="compact-form" onSubmit={fund}><label>Amount (NGN)<input name="amount" inputMode="decimal" pattern="\d+(?:\.\d{1,2})?" placeholder="5000.00" required/></label><label>Provider<select name="provider" defaultValue="paystack"><option value="paystack">Paystack</option><option value="monnify">Monnify</option></select></label><button className="button primary">Create funding request</button></form></section>
        <section className="panel"><h2>Virtual accounts</h2>{data.v.virtualAccounts.length?data.v.virtualAccounts.map((v:any)=><div className="account-card" key={v.id}><strong>{v.bankName||v.providerCode}</strong><span>{v.accountNumber}</span><small>{v.accountName}</small></div>):<p>No dedicated account yet. Complete BVN verification before provisioning.</p>}<details><summary>Provision a funding account</summary><form className="compact-form" onSubmit={provision}><label>Provider<select name="provider" defaultValue="monnify"><option value="monnify">Monnify</option><option value="paystack">Paystack</option></select></label><label>Preferred bank (optional)<input name="preferredBank" maxLength={80}/></label><label>Paystack validation bank code<input name="validationBankCode" maxLength={20}/></label><label>Paystack validation account number<input name="validationAccountNumber" inputMode="numeric" pattern="\d{10}" maxLength={10}/></label><button className="button">Request account</button><small>Paystack requires validation bank details; Monnify ignores those two fields. TwiPay enforces verified BVN eligibility server-side.</small></form></details></section>
      </div>
      <section className="panel"><h2>Bank transfer</h2><form className="compact-form grid-form" onSubmit={transfer}><label>Provider<select name="provider" defaultValue="monnify"><option value="monnify">Monnify</option><option value="paystack">Paystack</option></select></label><label>Bank code<input name="bankCode" required minLength={2} maxLength={20}/></label><label>Account number<input name="accountNumber" required inputMode="numeric" pattern="\d{10}" maxLength={10}/></label><label>Amount (NGN)<input name="amount" required inputMode="decimal" pattern="\d+(?:\.\d{1,2})?"/></label><label>Narration<input name="narration" required minLength={3} maxLength={120}/></label><button className="button primary">Resolve & review transfer</button></form><small>We check recipient details before you confirm. If a transfer takes longer than expected, check its status before trying again.</small></section>
      <section className="panel"><h2>Transaction history</h2><div className="list">{data.t.transactions.map((t:any)=><div className="list-row" key={t.reference}><div><strong>{t.description||t.type}</strong><small>{new Date(t.createdAt).toLocaleString()} · {t.reference}</small></div><div className="align-right"><strong>{formatMinor(t.amountMinor,t.currency)}</strong><span className="status">{t.status}</span></div></div>)}</div></section>
      {message&&<section className="panel"><p className="small">{message}</p></section>}
    </>}
  </AppShell>
}
