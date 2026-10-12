import api from '../axios';
export type TNotification={id:string;category:'SECURITY'|'SUPPORT'|'EVENTS';title:string;message:string;targetPath:string;readAt:string|null;createdAt:string};
export type NotificationInbox={items:TNotification[];unreadCount:number;hasMore:boolean;nextCursor:string|null};
export type NotificationPreferences={supportInApp:boolean;eventInApp:boolean;supportEmail:boolean};
const allowedPaths=new Set(['/dashboard/settings/security-overview','/dashboard/settings/support-centre','/dashboard/my-tickets']);
const categories=new Set(['SECURITY','SUPPORT','EVENTS']);
/** A real, owner-scoped in-app inbox; never displays or caches one-time verification credentials. */
export async function getNotificationInbox(cursor?:string):Promise<NotificationInbox> {
 const {data}=await api.get('/notifications/inbox',{params:cursor?{cursor}:undefined});
 if(!data||!Array.isArray(data.items)||data.items.length>50||!Number.isInteger(data.unreadCount)||data.unreadCount<0||typeof data.hasMore!=='boolean'||(data.nextCursor!==null&&(typeof data.nextCursor!=='string'||!/^[0-9a-f-]{36}$/i.test(data.nextCursor))))throw new TypeError('Invalid notification inbox');
 const items=data.items.map((value:unknown)=>{
  if(!value||typeof value!=='object')throw new TypeError('Invalid notification item');
  const v=value as Record<string,unknown>;
  if(typeof v.id!=='string'||!/^[0-9a-f-]{36}$/i.test(v.id)||typeof v.title!=='string'||typeof v.message!=='string'||v.title.length>120||v.message.length>240||!allowedPaths.has(String(v.targetPath))||!categories.has(String(v.category))||typeof v.createdAt!=='string'||!Number.isFinite(Date.parse(v.createdAt))||(v.readAt!==null&&(typeof v.readAt!=='string'||!Number.isFinite(Date.parse(v.readAt)))))throw new TypeError('Invalid notification item');
  return {id:v.id,title:v.title,message:v.message,category:v.category,targetPath:v.targetPath,readAt:v.readAt,createdAt:v.createdAt} as TNotification;
 });
 return {items,unreadCount:data.unreadCount,hasMore:data.hasMore,nextCursor:data.nextCursor};
}
export async function markNotificationRead(id:string){await api.post(`/notifications/inbox/${id}/read`,{});}
export async function markAllNotificationsRead(){await api.post('/notifications/inbox/read-all',{});}
export async function getNotificationPreferences():Promise<NotificationPreferences>{const {data}=await api.get('/notifications/preferences');const v=data?.preferences;if(!v||typeof v.supportEmail!=='boolean'||typeof v.supportInApp!=='boolean'||typeof v.eventInApp!=='boolean')throw new TypeError('Invalid preferences');return {supportInApp:v.supportInApp,eventInApp:v.eventInApp,supportEmail:v.supportEmail};}
export async function saveNotificationPreferences(input:NotificationPreferences):Promise<NotificationPreferences>{const {data}=await api.put('/notifications/preferences',input);const v=data?.preferences;if(!v||typeof v.supportEmail!=='boolean'||typeof v.supportInApp!=='boolean'||typeof v.eventInApp!=='boolean')throw new TypeError('Invalid saved preferences');return v as NotificationPreferences;}
