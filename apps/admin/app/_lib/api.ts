export const API_BASE = process.env['NEXT_PUBLIC_API_URL']?.replace(/\/$/, '') ?? '';
export class OpsApiError extends Error{constructor(public status:number,public code:string){super(code)}}
// Staff see sentences, not machine codes. Known codes get a written explanation; any other UPPER_SNAKE code is spelled out in
// words so a new server code is still readable. Strings that are not codes (already sentences) pass through unchanged.
const CODE_MESSAGES:Record<string,string>={
  MFA_STEP_UP_REQUIRED:'Confirm your authenticator code (step-up) to continue.',
  MFA_CHALLENGE_REQUIRED:'Enter your authenticator code to continue.',
  AUTHENTICATION_REQUIRED:'Please sign in again.',
  PERMISSION_REQUIRED:'Your role does not allow this action.',
  INDEPENDENT_OWNER_CHECKER_REQUIRED:'A different owner must approve this. You cannot approve your own proposal.',
  SELF_APPROVAL_FORBIDDEN:'You cannot approve your own proposal.',
  FINANCIAL_TIER_REVIEW_NOT_QUALIFIED:'Financial tier reviews are not available yet on this environment.',
  REQUEST_FAILED:'The request failed. Please try again.',
  API_NOT_CONFIGURED:'The admin console is not connected to the API.'
};
export function explainCode(code:string|undefined|null,fallback='REQUEST_FAILED'):string{
  const c=(code||fallback).trim();
  const known=CODE_MESSAGES[c];if(known)return known;
  if(!/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(c))return c;
  const words=c.toLowerCase().replace(/_/g,' ');return words.charAt(0).toUpperCase()+words.slice(1)+'.';
}
export function statusLabel(status:string):string{const w=status.toLowerCase().replace(/_/g,' ');return w.charAt(0).toUpperCase()+w.slice(1)}
async function decode(r:Response){const t=await r.text();try{return t?JSON.parse(t):{}}catch{return {}}}
export async function opsGet<T>(path:string):Promise<T>{if(!API_BASE)throw new OpsApiError(500,'API_NOT_CONFIGURED');const r=await fetch(`${API_BASE}/v1${path}`,{credentials:'include',cache:'no-store'});const b=await decode(r);if(!r.ok)throw new OpsApiError(r.status,b?.code??'REQUEST_FAILED');return b as T}
async function csrf(){return (await opsGet<{csrfToken:string}>('/auth/csrf')).csrfToken}
export async function opsMutation<T>(path:string,body?:unknown,method:'POST'|'PATCH'='POST'):Promise<T>{const token=await csrf();const r=await fetch(`${API_BASE}/v1${path}`,{method,credentials:'include',cache:'no-store',headers:{'content-type':'application/json','x-csrf-token':token},body:JSON.stringify(body??{})});const b=await decode(r);if(!r.ok)throw new OpsApiError(r.status,b?.code??'REQUEST_FAILED');return b as T}
export function money(v:string|number|bigint,c='NGN'){
  const amount=typeof v==='bigint'?v:BigInt(v);const negative=amount<0n;const absolute=negative?-amount:amount;
  const major=absolute/100n;const fraction=(absolute%100n).toString().padStart(2,'0');
  const formatter=new Intl.NumberFormat('en-NG',{style:'currency',currency:c,minimumFractionDigits:0,maximumFractionDigits:0});
  const parts=formatter.formatToParts(negative?-major:major);let last=-1;
  for(let i=0;i<parts.length;i+=1){if(parts[i]?.type==='integer'||parts[i]?.type==='group')last=i}
  if(last<0)return formatter.format(negative?-major:major);
  parts.splice(last+1,0,{type:'decimal',value:'.'},{type:'fraction',value:fraction});return parts.map(x=>x.value).join('');
}
