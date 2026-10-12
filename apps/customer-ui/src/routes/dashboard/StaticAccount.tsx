import BackButton from '@/components/Authentication/BackButton';
import CreateStaticAccount from '@/components/dashboard/static-account/CreateStaticAccount';
import StaticAccountDetails from '@/components/dashboard/static-account/StaticAccountDetails';
import { listVirtualAccounts } from '@/lib/api/dashboard-apis/virtualAccounts';
import { useQuery } from '@tanstack/react-query';

export default function StaticAccount() {
  const list=useQuery({queryKey:['twipay','virtual-accounts'],queryFn:listVirtualAccounts,refetchOnWindowFocus:true});
  const active = list.data?.virtualAccounts.filter(a=>a.status === 'ACTIVE') ?? [];
  return <div className="w-full min-h-full grid place-items-center">
    <section className="w-full max-w-[410px] max-md:self-start">
      <BackButton className="mb-8 mr-auto max-md:hidden" href="/dashboard"/>
      {list.isLoading && <p role="status" className="text-[#667085] text-sm">Loading your virtual accounts…</p>}
      {list.isError && <div role="alert" className="text-red-600 text-sm">Could not load your accounts. We cannot assume an account has not been created. <button type="button" onClick={()=>void list.refetch()} className="underline">Retry</button></div>}
      {list.data && <>
        {list.data.virtualAccounts.length > 0 && <StaticAccountDetails accounts={list.data.virtualAccounts}/>}
        {list.data.provisioning.length > 0 && <div className="bg-white md:mt-8 rounded-sm py-6 px-4 text-sm text-[#344054]">
          <h2 className="font-medium">Account provisioning requests</h2>
          {list.data.provisioning.slice(0,5).map(op=><p key={op.reference} className="mt-3 text-xs text-[#667085] break-all">{op.provider}: {op.reference} — {op.status}</p>)}
          <button type="button" onClick={()=>void list.refetch()} className="underline mt-4">Refresh status</button>
        </div>}
        {active.length < 2 && <div className={list.data.virtualAccounts.length ? 'mt-8' : ''}><CreateStaticAccount onRefresh={list.refetch}/></div>}
      </>}
    </section>
  </div>;
}
