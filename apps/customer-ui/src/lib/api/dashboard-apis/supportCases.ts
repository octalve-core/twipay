import api from '../axios';

export type SupportCaseSummary={reference:string;category:string;subject:string;status:string;createdAt:string;updatedAt:string};
export type SupportCaseDetail=SupportCaseSummary&{messages:{id:string;authorType:'CUSTOMER'|'STAFF';text:string;createdAt:string}[]};
const referencePattern=/^sup_[0-9a-f-]{36}$/;
function summary(raw:unknown):SupportCaseSummary {
 if(!raw||typeof raw!=='object')throw new TypeError('Invalid support response');const v=raw as Record<string,unknown>;
 if(typeof v.reference!=='string'||!referencePattern.test(v.reference)||typeof v.subject!=='string'||typeof v.category!=='string'||!['WAITING_CUSTOMER','WAITING_SUPPORT','CLOSED'].includes(String(v.status))||typeof v.createdAt!=='string'||typeof v.updatedAt!=='string')throw new TypeError('Invalid support case');
 return {reference:v.reference,subject:v.subject,category:v.category,status:String(v.status),createdAt:v.createdAt,updatedAt:v.updatedAt};
}
export async function listSupportCases():Promise<SupportCaseSummary[]>{const {data}=await api.get('/support/cases');if(!Array.isArray(data?.cases)||data.cases.length>50)throw new TypeError('Invalid support cases');return data.cases.map(summary);}
export async function getSupportCase(reference:string):Promise<SupportCaseDetail>{if(!referencePattern.test(reference))throw new TypeError('Invalid support reference');const {data}=await api.get(`/support/cases/${reference}`);const c=summary(data?.case);if(!Array.isArray(data?.case?.messages)||data.case.messages.length>100)throw new TypeError('Invalid support conversation');return {...c,messages:data.case.messages.map((v:unknown)=>{if(!v||typeof v!=='object')throw new TypeError('Invalid support message');const msg=v as Record<string,unknown>;if(typeof msg.id!=='string'||typeof msg.text!=='string'||!['CUSTOMER','STAFF'].includes(String(msg.authorType))||typeof msg.createdAt!=='string')throw new TypeError('Invalid support message');return {id:msg.id,text:msg.text,authorType:msg.authorType as 'CUSTOMER'|'STAFF',createdAt:msg.createdAt};})};}
export async function openSupportCase(v:{category:'GENERAL'|'ACCOUNT'|'EVENTS'|'TECHNICAL';subject:string;message:string;requestKey:string}):Promise<SupportCaseSummary>{const {data}=await api.post('/support/cases',v);return summary(data?.case);}
export async function replySupportCase(reference:string,v:{message:string;requestKey:string}):Promise<SupportCaseSummary>{if(!referencePattern.test(reference))throw new TypeError('Invalid support reference');const {data}=await api.post(`/support/cases/${reference}/replies`,v);return summary(data?.case);}
