"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiGet, apiMutation } from '../_lib/api';
import { useBrand } from './brand-provider';

const navigation=[['/dashboard','Overview'],['/wallet','Wallet'],['/services','Services'],['/events','Events'],['/tickets','Tickets'],['/organizer','Organize'],['/profile','Profile'],['/support','Support']] as const;

export function AppShell({children,title,subtitle}:{children:React.ReactNode;title:string;subtitle?:string}){
  const path=usePathname(); const router=useRouter(); const brand=useBrand(); const [name,setName]=useState('');
  useEffect(()=>{ apiGet<any>('/auth/me').then(v=>setName(v.user?.givenName||v.user?.email||'')).catch(e=>{if(e?.status===401)router.replace('/login')}); },[router]);
  async function logout(){try{await apiMutation('/auth/logout','POST');}finally{router.replace('/login');router.refresh();}}
  return <div className="app-frame"><aside className="sidebar"><Link className="brandmark" href="/dashboard"><span className="brand-dot"/>{brand.productName}</Link><nav className="side-nav">{navigation.map(([href,label])=><Link key={href} href={href} className={path===href||path.startsWith(href+'/')?'active':''}>{label}</Link>)}</nav><div className="side-bottom"><span className="small">{name||'Secure session'}</span><button className="text-button" onClick={logout}>Sign out</button></div></aside><main className="app-main"><header className="page-head"><div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div><span className="secure-pill">Secure session</span></header>{children}</main></div>;
}
