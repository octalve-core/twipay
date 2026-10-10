"use client";
import Link from 'next/link';
import {usePathname,useRouter} from 'next/navigation';
import {useEffect,useState} from 'react';
import {opsGet,opsMutation} from '../_lib/api';
const nav:[string,string,string][]=[
 ['/', 'Overview','ops.dashboard.read'],['/refunds','Refunds','ops.disputes.review'],
 ['/support','Support','ops.support.read'],['/notifications','Delivery health','ops.notifications.read'],
 ['/exceptions','Exceptions','ops.reconciliation.read'],['/financial-tiers','Financial tiers','ops.tiers.read'],
 ['/payouts','Payouts','ops.dashboard.read'],['/providers','Providers','ops.dashboard.read'],
 ['/compliance','Compliance','ops.compliance.read'],['/reports','Reports','ops.reports.read'],
 ['/config','Configuration','ops.feature_flags.manage'],['/security','Security',''],['/audit','Audit','ops.audit.read'],
];
const ownerNav:[string,string][]=[['/owner','Owner overview'],['/owner/customers','Customers'],['/owner/staff','Staff governance']];
export function OpsShell({title,children}:{title:string;children:React.ReactNode}){
 const path=usePathname();const router=useRouter();const[user,setUser]=useState<any>();
 useEffect(()=>{opsGet<any>('/auth/me').then(v=>{
  setUser(v);const allowed=Array.isArray(v.permissions)&&v.permissions.some((p:string)=>p.startsWith('ops.'));
  if(!allowed)router.replace('/login');
 }).catch(()=>router.replace('/login'))},[router]);
 async function logout(){try{await opsMutation('/auth/logout')}finally{router.replace('/login')}}
 const isOwner=user?.roles?.includes('SUPER_ADMIN');
 const links=[...(isOwner?ownerNav:[]),...nav.filter(([,,permission])=>permission===''||isOwner||user?.permissions?.includes(permission)).map(([url,label])=>[url,label] as [string,string])];
 return <div className="ops-frame"><aside className="ops-side">
  <Link href="/" className="ops-brand"><span/>TwiPay <small>Operations</small></Link>
  <nav>{links.map(([href,label])=><Link href={href} key={href} className={path===href?'active':''}>{label}</Link>)}</nav>
  <div className="ops-user"><small>{user?.user?.email||'Authorizing…'}</small>
   <span>{user?.mfaSatisfied?'MFA satisfied':'MFA step-up pending'}</span><button onClick={logout}>Sign out</button></div>
 </aside><main className="ops-main"><header><div><span className="eyebrow">Restricted · audited</span><h1>{title}</h1></div><span className="secure">RBAC enforced</span></header>{children}</main></div>;
}
