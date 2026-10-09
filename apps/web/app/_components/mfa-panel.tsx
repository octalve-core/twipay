"use client";
import {FormEvent,useEffect,useState} from 'react';
import {apiGet,apiMutation} from '../_lib/api';

type Status={enabled:boolean;enabledAt:string|null;recoveryCodesRemaining:number;enrollmentPending:boolean;enrollmentStartedAt:string|null};
type Enrollment={credentialId:string;manualSecret:string;otpauthUri:string;expiresAt:string};

export function MfaPanel({onAssuranceChanged}:{onAssuranceChanged?:()=>void}){
  const[status,setStatus]=useState<Status>();const[enrollment,setEnrollment]=useState<Enrollment>();const[codes,setCodes]=useState<string[]>([]);const[msg,setMsg]=useState('');
  async function load(){try{setStatus((await apiGet<{mfa:Status}>('/auth/mfa/status')).mfa)}catch(x:any){setMsg(x.code||'Unable to load MFA status')}}
  useEffect(()=>{void load()},[]);
  async function begin(ev:FormEvent<HTMLFormElement>){ev.preventDefault();const f=new FormData(ev.currentTarget);try{const r=await apiMutation<{enrollment:Enrollment}>('/auth/mfa/enroll','POST',{password:String(f.get('password')||'')});setEnrollment(r.enrollment);setCodes([]);setMsg('Enrollment started. Add the key to your authenticator, then confirm a fresh 6-digit code.');await load()}catch(x:any){setMsg(x.code||'Unable to begin MFA enrollment')}}
  async function confirm(ev:FormEvent<HTMLFormElement>){ev.preventDefault();const f=new FormData(ev.currentTarget);try{const r=await apiMutation<{recoveryCodes:string[]}>('/auth/mfa/enroll/confirm','POST',{code:String(f.get('code')||'')});setCodes(r.recoveryCodes);setEnrollment(undefined);setMsg('Two-factor authentication is on. Save your recovery codes somewhere safe; you won’t be able to view them again.');await load();onAssuranceChanged?.()}catch(x:any){setMsg(x.code||'Unable to confirm MFA')}}
  async function challenge(ev:FormEvent<HTMLFormElement>){ev.preventDefault();const f=new FormData(ev.currentTarget);try{const r=await apiMutation<{method:string}>('/auth/mfa/challenge','POST',{code:String(f.get('code')||'')});setMsg(`Extra verification complete.`);onAssuranceChanged?.()}catch(x:any){setMsg(x.code||'Unable to satisfy MFA step-up')}}
  async function regenerate(ev:FormEvent<HTMLFormElement>){ev.preventDefault();const f=new FormData(ev.currentTarget);try{const r=await apiMutation<{recoveryCodes:string[]}>('/auth/mfa/recovery-codes/regenerate','POST',{code:String(f.get('code')||'')});setCodes(r.recoveryCodes);setMsg('Recovery codes replaced. Previous unused recovery codes are no longer valid.');await load();onAssuranceChanged?.()}catch(x:any){setMsg(x.code||'Unable to regenerate recovery codes')}}
  async function disable(ev:FormEvent<HTMLFormElement>){ev.preventDefault();const f=new FormData(ev.currentTarget);try{await apiMutation('/auth/mfa/disable','POST',{code:String(f.get('code')||''),reason:'USER_DISABLED_FROM_PROFILE'});setCodes([]);setEnrollment(undefined);setMsg('MFA disabled and other active sessions revoked. Re-enrollment creates a new credential.');await load();onAssuranceChanged?.()}catch(x:any){setMsg(x.code||'Unable to disable MFA')}}
  return <section className="panel"><h2>Two-factor authentication</h2><p>Add an extra layer of protection to your account using an authenticator app.</p>
    {!status?<p>Loading MFA status…</p>:status.enabled?<>
      <dl className="facts"><div><dt>Status</dt><dd>Enabled</dd></div><div><dt>Recovery codes remaining</dt><dd>{status.recoveryCodesRemaining}</dd></div></dl>
      <form className="compact-form" onSubmit={challenge}><label>Authenticator or recovery code<input name="code" autoComplete="one-time-code" required maxLength={32}/></label><button className="button primary">Verify it’s you</button></form>
      <form className="compact-form" onSubmit={regenerate}><label>Current authenticator/recovery code<input name="code" autoComplete="one-time-code" required maxLength={32}/></label><button className="button">Replace recovery codes</button></form>
      <form className="compact-form" onSubmit={disable}><label>Current authenticator/recovery code<input name="code" autoComplete="one-time-code" required maxLength={32}/></label><button className="button">Disable MFA</button></form>
    </>:<form className="compact-form" onSubmit={begin}><p>Two-factor authentication is off. Enter your password to get started.</p><label>Password<input name="password" type="password" autoComplete="current-password" required/></label><button className="button primary">Start MFA enrollment</button></form>}
    {enrollment&&<><div className="notice"><strong>Authenticator setup key</strong><p><code>{enrollment.manualSecret}</code></p><small>Enrollment expires {new Date(enrollment.expiresAt).toLocaleString()}.</small><details><summary>Authenticator URI</summary><code>{enrollment.otpauthUri}</code></details></div><form className="compact-form" onSubmit={confirm}><label>6-digit authenticator code<input name="code" inputMode="numeric" pattern="\d{6}" autoComplete="one-time-code" required maxLength={6}/></label><button className="button primary">Confirm and enable MFA</button></form></>}
    {codes.length>0&&<div className="notice"><strong>Recovery codes — save once</strong><p>Each code works once. Store them offline; do not paste them into support chats.</p><pre>{codes.join('\n')}</pre></div>}
    {msg&&<p className="small">{msg}</p>}
  </section>
}
