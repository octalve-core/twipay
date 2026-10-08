import api from '../axios';
export type TNotification = {id:string;title:string;templateCode:string;channel:string;deliveryStatus:string;createdAt:string;updatedAt:string};
/** These are TwiPay notification delivery records, not read/unread inbox messages. */
export async function getAllNotifications():Promise<TNotification[]> {
 const {data}=await api.get('/notifications');if(!Array.isArray(data?.notifications)||data.notifications.length>100)throw new TypeError('Invalid TwiPay notification history');
 return data.notifications.map((raw:unknown)=>{
  if(!raw||typeof raw!=='object')throw new TypeError('Invalid notification entry');
  const v=raw as Record<string,unknown>;
  if(typeof v.id!=='string'||typeof v.title!=='string'||typeof v.deliveryStatus!=='string'||typeof v.createdAt!=='string'||typeof v.channel!=='string'||!Number.isFinite(Date.parse(v.createdAt)))throw new TypeError('Invalid notification data');
  return {id:v.id,title:v.title,templateCode:String(v.templateCode),channel:v.channel,deliveryStatus:v.deliveryStatus,createdAt:v.createdAt,updatedAt:String(v.updatedAt)} as TNotification;
 });
}
