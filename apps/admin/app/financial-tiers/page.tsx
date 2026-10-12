'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {OpsShell} from '../_components/ops-shell';
import {Fail,Wait} from '../_components/state';
import {money,opsGet,opsMutation} from '../_lib/api';
type Review={id:string;userId:string;status:string;proposedTier:number;maxPerIntentMinor:string;maxDailyDebitMinor:string;evidenceReference:string;preparedByUserId:string;createdAt:string};
export default function FinancialTierPage(){
  const[data,setData]=useState<{reviews:Review[];bounded:boolean}>();
  const[error,setError]=useState(''); const[message,setMessage]=useState('');
  async function refresh(){try{setData(await opsGet('/operations/financial-eligibility/reviews'));setError('')}catch(e:any){setError(e.code??'REQUEST_FAILED')}}
  useEffect(()=>{void refresh()},[]);
  async function prepare(event:FormEvent<HTMLFormElement>){event.preventDefault();
    const form=new FormData(event.currentTarget);const body={tier:Number(form.get('tier')),
      maxPerIntentMinor:String(form.get('maxPerIntentMinor')),maxDailyDebitMinor:String(form.get('maxDailyDebitMinor')),
      evidenceReference:String(form.get('evidenceReference')),note:String(form.get('note'))};
    const userId=String(form.get('userId'));
    if(!window.confirm('This creates a review only. Independent authorization and real KYC evidence are required. Continue?'))return;
    try{await opsMutation(`/operations/financial-eligibility/${encodeURIComponent(userId)}/prepare`,body);
      setMessage('Review prepared. Another authorized person must independently approve it.');await refresh()}
    catch(e:any){setMessage(e.code??'PREPARATION_BLOCKED')}
  }
  async function decide(id:string,approve:boolean){
    if(!window.confirm('Independently verify actual identity evidence and tier limits. This action is audited. Continue?'))return;
    const reason=approve?undefined:window.prompt('Reason for rejection (minimum 5 characters)');
    if(!approve&&(!reason||reason.trim().length<5))return;
    try{await opsMutation(`/operations/financial-eligibility/reviews/${id}/${approve?'approve':'reject'}`,
      approve?{}:{reason});setMessage(approve?'Tier approval recorded (financial features stay disabled).':'Review rejected.');await refresh()}
    catch(e:any){setMessage(e.code??'INDEPENDENT_REVIEW_BLOCKED')}
  }
  return <OpsShell title="Financial tier reviews">
    <div className="ops-note warning"><strong>Default-deny controls</strong><span>Financial tiers require verified contact, current BVN evidence, enrolled MFA, separately configured policy caps and two different authorized reviewers. This screen never enables transfers or provider flags. Available only in approved disposable sandbox configuration.</span></div>
    <section className="ops-panel"><h2>Prepare independent review</h2>
      <form onSubmit={prepare} className="ops-form" style={{display:'grid',gap:12,maxWidth:520}}>
        <label>Customer ID <input name="userId" type="text" required pattern="[0-9a-fA-F-]{36}" /></label>
        <label>Proposed tier <select name="tier"><option value="1">Tier 1</option><option value="2">Tier 2</option><option value="3">Tier 3</option></select></label>
        <label>Maximum per intent (minor NGN units) <input name="maxPerIntentMinor" type="text" pattern="[1-9][0-9]*" required /></label>
        <label>Maximum daily debit (minor NGN units) <input name="maxDailyDebitMinor" type="text" pattern="[1-9][0-9]*" required /></label>
        <label>Verified BVN check ID (UUID) <input name="evidenceReference" required pattern="[0-9a-fA-F-]{36}" /></label>
        <label>Risk and KYC decision note <textarea name="note" minLength={30} maxLength={1000} required /></label>
        <button type="submit">Prepare review</button>
      </form>
    </section>
    {error?<Fail code={error}/>:!data?<Wait/>:<section className="ops-panel"><h2>Pending reviews</h2>
      <div className="table"><div className="tr th"><span>Customer</span><span>Tier / limits</span><span>Evidence</span><span>Independent action</span></div>
        {data.reviews.map(r=><div className="tr" key={r.id}><span>{r.userId}<small>Prepared {new Date(r.createdAt).toLocaleString()}</small></span>
          <span>Tier {r.proposedTier}<small>{money(r.maxPerIntentMinor)} per intent</small><small>{money(r.maxDailyDebitMinor)} daily</small></span>
          <span>{r.evidenceReference}<small>Maker: {r.preparedByUserId}</small></span>
          <span className="actions-inline"><button onClick={()=>decide(r.id,true)}>Approve after review</button><button onClick={()=>decide(r.id,false)}>Reject</button></span>
        </div>)}
      </div>{data.reviews.length===0&&<p className="small">No pending reviews.</p>}
    </section>}
    {message&&<p role="status">{message}</p>}
  </OpsShell>
}
