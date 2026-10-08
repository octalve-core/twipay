import api from '../axios';
export type CustomerDispute={reference:string;status:string;category:string;reasonCode:string;openedAt:string;resolvedAt:string|null};
function readDispute(raw:unknown):CustomerDispute {if(!raw||typeof raw!=='object')throw new TypeError('Invalid dispute');const v=raw as Record<string,unknown>;if(typeof v.reference!=='string'||!/^[-A-Za-z0-9._:]{1,100}$/.test(v.reference)||typeof v.status!=='string'||typeof v.category!=='string'||typeof v.reasonCode!=='string'||typeof v.openedAt!=='string')throw new TypeError('Invalid dispute response');return {reference:v.reference,status:v.status,category:v.category,reasonCode:v.reasonCode,openedAt:v.openedAt,resolvedAt:typeof v.resolvedAt==='string'?v.resolvedAt:null};}
export async function listDisputes():Promise<CustomerDispute[]> {const {data}=await api.get('/disputes');if(!Array.isArray(data?.disputes)||data.disputes.length>100)throw new TypeError('Invalid dispute history');return data.disputes.map(readDispute);}
export async function createDispute(input:{financialReference:string;category:string;reasonCode:string;details:string}):Promise<CustomerDispute> {
 if(!/^[A-Za-z0-9._:-]{6,100}$/.test(input.financialReference)||!['TRANSACTION','EVENT_ORDER'].includes(input.category)||!['UNRECOGNIZED_DEBIT','PAYMENT_NOT_RECEIVED','TICKET_ISSUE','OTHER'].includes(input.reasonCode)||input.details.trim().length<10||input.details.length>5000)throw new TypeError('Invalid dispute information');
 const {data}=await api.post('/disputes',input);return readDispute({...data.dispute,resolvedAt:null});
}
