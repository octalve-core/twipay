"use client";
import {FormEvent,useEffect,useState} from 'react';
import {AppShell} from '../_components/app-shell';
import {apiGet,apiMutation} from '../_lib/api';
import {ErrorCard,LoadingCard} from '../_components/load-state';

export default function Profile(){
  const[d,setD]=useState<any>();
  const[kyc,setKyc]=useState<any[]>([]);
  const[e,setE]=useState('');
  const[msg,setMsg]=useState('');
  async function load(){
    try{
      const [me,verifications]=await Promise.all([apiGet<any>('/auth/me'),apiGet<any>('/kyc/verifications')]);
      setD(me);setKyc(verifications.verifications??[]);setE('');
    }catch(x:any){setE(x.code||'REQUEST_FAILED')}
  }
  useEffect(()=>{void load()},[]);
  async function save(ev:FormEvent<HTMLFormElement>){
    ev.preventDefault();const f=new FormData(ev.currentTarget);
    try{const r=await apiMutation<any>('/auth/me','PATCH',{givenName:String(f.get('givenName')||'')||null,familyName:String(f.get('familyName')||'')||null});setD((old:any)=>({...old,user:r.user}));setMsg('Profile updated.')}catch(x:any){setMsg(x.code||'Unable to update profile')}
  }
  async function startKyc(ev:FormEvent<HTMLFormElement>){
    ev.preventDefault();const f=new FormData(ev.currentTarget);
    try{
      const r=await apiMutation<any>('/kyc/verifications','POST',{type:String(f.get('type')),identifier:String(f.get('identifier')).trim(),consent:true,scope:'bank_accounts'},{idempotent:true});
      setMsg(`Verification ${r.verificationId}: ${r.status}.`);await load();
    }catch(x:any){setMsg(x.code||'Unable to start verification')}
  }
  async function continueKyc(ev:FormEvent<HTMLFormElement>){
    ev.preventDefault();const f=new FormData(ev.currentTarget);const action=String(f.get('action'));
    const body:any={action};
    if(action==='REQUEST_OTP'){
      const method=String(f.get('verificationMethod')||'').trim();
      const phone=String(f.get('phoneNumber')||'').trim();
      if(method)body.verificationMethod=method;if(phone)body.phoneNumber=phone;
    }else body.otp=String(f.get('otp')||'').trim();
    try{const r=await apiMutation<any>(`/kyc/verifications/${String(f.get('verificationId'))}/continue`,'POST',body,{idempotent:true});setMsg(`Verification ${r.verificationId}: ${r.status}.`);await load()}catch(x:any){setMsg(x.code||'Unable to continue verification')}
  }
  return <AppShell title="Profile & security" subtitle="Account details, identity verification and security posture.">
    {e?<ErrorCard message={e}/>:!d?<LoadingCard/>:<>
      <div className="two-col">
        <section className="panel"><h2>Profile</h2><form className="compact-form" onSubmit={save}><label>Email<input value={d.user.email} disabled/></label><label>First name<input name="givenName" defaultValue={d.user.givenName||''}/></label><label>Last name<input name="familyName" defaultValue={d.user.familyName||''}/></label><button className="button primary">Save profile</button></form></section>
        <section className="panel"><h2>Security</h2><dl className="facts"><div><dt>Account status</dt><dd>{d.user.status}</dd></div><div><dt>MFA assurance</dt><dd>{d.mfaSatisfied?'Recent MFA step-up satisfied':'Step-up required for protected operations'}</dd></div><div><dt>Session</dt><dd>HttpOnly · Secure · SameSite</dd></div></dl><p>TwiPay never stores the session credential in localStorage.</p></section>
      </div>
      <div className="two-col">
        <section className="panel"><h2>Verify identity</h2><p>BVN/NIN verification is performed server-to-server. TwiPay records explicit consent and never sends the identifier in a URL.</p><form className="compact-form" onSubmit={startKyc}><label>Identity type<select name="type" defaultValue="BVN"><option value="BVN">BVN</option><option value="NIN">NIN</option></select></label><label>11-digit identifier<input name="identifier" inputMode="numeric" pattern="\d{11}" maxLength={11} required autoComplete="off"/></label><label className="checkbox-row"><input type="checkbox" required/> I consent to this identity verification for TwiPay account/banking eligibility.</label><button className="button primary">Start verification</button></form></section>
        <section className="panel"><h2>Continue verification</h2><form className="compact-form" onSubmit={continueKyc}><label>Verification<select name="verificationId" required>{kyc.filter((x:any)=>!['VERIFIED','FAILED','EXPIRED'].includes(x.status)).map((x:any)=><option key={x.id} value={x.id}>{x.type} · ••••{x.identifierLast4} · {x.status}</option>)}</select></label><label>Action<select name="action" defaultValue="SUBMIT_OTP"><option value="SUBMIT_OTP">Submit OTP</option><option value="REQUEST_OTP">Request OTP</option></select></label><label>OTP<input name="otp" inputMode="numeric" maxLength={10}/></label><label>Verification method (when requesting OTP)<input name="verificationMethod" maxLength={40}/></label><label>Phone (only if provider requires it)<input name="phoneNumber" autoComplete="tel"/></label><button className="button">Continue verification</button></form></section>
      </div>
      <section className="panel"><h2>Verification history</h2><div className="list">{kyc.length?kyc.map((x:any)=><div className="list-row" key={x.id}><div><strong>{x.type} · ••••{x.identifierLast4}</strong><small>{x.providerCode} · {new Date(x.createdAt).toLocaleString()}</small></div><span className="status">{x.status}</span></div>):<p>No identity verifications yet.</p>}</div></section>
      {msg&&<section className="panel"><p className="small">{msg}</p></section>}
    </>}
  </AppShell>
}
