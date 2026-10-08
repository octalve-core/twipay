export const API_BASE = process.env['NEXT_PUBLIC_API_URL']?.replace(/\/$/, '') ?? '';
export class OpsApiError extends Error{constructor(public status:number,public code:string){super(code)}}
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
