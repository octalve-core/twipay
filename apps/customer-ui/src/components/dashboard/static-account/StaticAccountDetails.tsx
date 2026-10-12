import BackButton from '@/components/Authentication/BackButton';
import AccountCardItem from './AccountCardItem';
import type { VirtualAccount } from '@/lib/api/dashboard-apis/virtualAccounts';

export default function StaticAccountDetails({accounts}: {accounts:VirtualAccount[]}) {
  return <section className="w-full max-md:self-start">
    <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
      <BackButton icon href="/dashboard"/><p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Static account</p>
    </div>
    <p className="md:hidden text-xl text-[#344054] font-medium mt-14 mb-6 text-center">Your assigned static accounts</p>
    <div className="max-md:hidden"><h1 className="text-2xl text-[#112929] font-medium">Static account</h1>
      <p className="text-[#717171] mt-2">View the details of your static account</p></div>
    {accounts.map(account=><div key={account.reference} className="flex flex-col gap-5 bg-white md:mt-8 rounded-sm py-6 px-4">
      <p className="text-[#667085] text-xs">{account.provider.toUpperCase()} — {account.status}</p>
      {account.status === 'ACTIVE' ? <>
        <AccountCardItem title="Owner name" value={account.accountName}/>
        <AccountCardItem title="Account number" value={account.accountNumber}/>
        <AccountCardItem title="Bank name" value={account.bankName}/>
      </> : <p className="text-sm text-[#717171]">This account is not active. Do not transfer funds to it.</p>}
    </div>)}
  </section>;
}
