import BackButton from '@/components/Authentication/BackButton';
import CustomButton from '@/components/CustomButton';
import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { getIdentityVerifications } from '@/lib/api/kycApi';
import {
  abandonVirtualAccountIntent,
  hasVirtualAccountIntent,
  listVirtualAccountValidationBanks,
  provisionVirtualAccount,
  type VirtualAccountProvider,
  type VirtualAccountResult,
} from '@/lib/api/dashboard-apis/virtualAccounts';
import { brand } from "@/config/brand";

const enabled = import.meta.env.VITE_TWIPAY_VIRTUAL_ACCOUNT_SANDBOX_ENABLED === 'true';
const field = 'w-full mt-1.5 border-[0.5px] border-[#D0D5DD] rounded-lg py-2.5 px-3.5 bg-white outline-none focus:border-[#112929] text-sm text-[#344054]';

export default function CreateStaticAccount({onRefresh}: {onRefresh:()=>Promise<unknown>}) {
  const [provider,setProvider] = useState<VirtualAccountProvider>('monnify');
  const [bankCode,setBankCode] = useState('');
  const [accountNumber,setAccountNumber] = useState('');
  const [consent,setConsent] = useState(false);
  const [pin,setPin] = useState('');
  const [pending,setPending] = useState(false);
  const [response,setResponse] = useState<VirtualAccountResult|null>(null);
  const [error,setError] = useState('');
  const kyc = useQuery({queryKey:['twipay','kyc','verifications'],queryFn:getIdentityVerifications});
  const verifiedBvn = kyc.data?.some(v=>v.type === 'BVN' && v.status === 'VERIFIED') === true;
  const banks = useQuery({
    queryKey:['twipay','virtual-accounts','validation-banks'],
    queryFn:listVirtualAccountValidationBanks,
    enabled: enabled && verifiedBvn && provider === 'paystack',
  });
  const validBank = provider === 'monnify' || (banks.data?.some(b=>b.bankCode === bankCode) === true && /^\d{10}$/.test(accountNumber));

  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!enabled || pending || !verifiedBvn || !consent || !validBank || !/^\d{4}$/.test(pin)) return;
    setPending(true); setError('');
    try {
      const result = await provisionVirtualAccount({
        provider,consent:true,transactionPin:pin,
        ...(provider === 'paystack' ? {validationBankCode:bankCode,validationAccountNumber:accountNumber} : {}),
      });
      setResponse(result);
      setAccountNumber(''); setBankCode(''); setConsent(false); setPin('');
      await onRefresh();
      if (result.status === 'ACTIVE') toast.success('Your bank account assignment has been confirmed.');
      else toast.info('Your request has been received. Please wait until your account is confirmed before using it.');
    } catch {
      setPin('');
      // The attempt key is retained. An unknown provider outcome must not trigger a new write.
      setError('We couldn’t confirm your account request. Check its status before trying again.');
    } finally {setPending(false);}
  }
  function resetAttempt(){
    if (!window.confirm('Review your existing account requests first. Starting a new intent does not cancel a pending provider request. Continue?')) return;
    abandonVirtualAccountIntent(); setResponse(null); setError(''); setAccountNumber(''); setBankCode(''); setPin('');
  }
  return <section className="w-full mx-auto max-md:self-start">
    <div className="flex items-center mb-10 mt-2 md:hidden fixed top-2 w-full max-w-[360px] mx-auto right-0 left-0 z-10 backdrop-blur-[2px] px-5">
      <BackButton icon href="/dashboard"/><p className="text-[#667085] font-medium text-xl w-full text-center mr-6">Static account</p>
    </div>
    <div className="max-md:hidden"><h1 className="text-[#112929] font-medium text-2xl">Create static account</h1>
      <p className="text-[#717171] mt-2">Enter the details below to create a static account</p></div>
    {!enabled && <p role="status" className="mt-6 text-[#667085] text-sm">Creating a new funding account is temporarily unavailable. You can still view accounts already assigned to you.</p>}
    {kyc.isLoading && <p role="status" className="mt-6 text-[#667085] text-sm">Checking identity eligibility…</p>}
    {kyc.isError && <p role="alert" className="mt-6 text-red-600 text-sm">Unable to confirm BVN eligibility. Account provisioning is unavailable.</p>}
    {kyc.isSuccess && !verifiedBvn && <p role="status" className="mt-6 text-[#667085] text-sm">A verified BVN is required before a funding account can be assigned. <Link to="/dashboard/settings/identity-verification" className="underline text-[#112929]">Complete identity verification</Link>. You won’t need to enter your BVN again here.</p>}
    {response && <p role="status" className="text-sm text-[#344054] mt-5">Provider: {response.provider}. Request {response.reference} — <strong>{response.status}</strong>. {response.status !== 'ACTIVE' ? 'Do not send funds until an ACTIVE account appears below.' : 'Account assignment is confirmed.'}</p>}
    {error && <p role="alert" className="text-red-600 mt-4 text-sm">{error}</p>}
    {enabled && verifiedBvn && <form onSubmit={submit} className="w-full mt-14 md:mt-8">
      <div className="w-full"><label htmlFor="va-provider" className="text-sm text-[#344054] font-medium">Account provider</label>
        <select id="va-provider" className={field} value={provider} disabled={pending} onChange={e=>{setProvider(e.target.value as VirtualAccountProvider);setError('');setResponse(null);setBankCode('');setAccountNumber('');}}>
          <option value="monnify">Monnify</option><option value="paystack">Paystack</option>
        </select></div>
      {provider === 'paystack' && <><div className="w-full mt-5"><label className="text-sm text-[#344054] font-medium" htmlFor="va-bank">Your existing bank</label>
        <select id="va-bank" className={field} value={bankCode} disabled={pending || banks.isLoading || banks.isError} onChange={e=>setBankCode(e.target.value)} required>
          <option value="">Choose bank</option>{banks.data?.map(b=><option key={b.bankCode} value={b.bankCode}>{b.name}</option>)}
        </select>{banks.isError && <p role="alert" className="text-red-600 text-sm mt-2">Could not retrieve a verified bank directory. Provisioning is unavailable.</p>}</div>
        <div className="w-full mt-5"><label htmlFor="va-account" className="text-sm text-[#344054] font-medium">Your existing bank account number (validation only)</label>
          <input id="va-account" className={field} type="text" inputMode="numeric" autoComplete="off" maxLength={10} pattern="[0-9]{10}" value={accountNumber} onChange={e=>setAccountNumber(e.target.value.replace(/\D/g,'').slice(0,10))} required />
          <p className="text-[#717171] text-xs mt-2">We use these details only to verify that the bank account belongs to you.</p></div></>}
      <div className="mt-5"><label htmlFor="virtual-account-pin" className="text-sm font-medium text-[#344054]">Transaction PIN</label>
        <input id="virtual-account-pin" className={field} type="password" inputMode="numeric" autoComplete="off" maxLength={4} pattern="[0-9]{4}"
          value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,4))} disabled={pending} required />
        <p className="text-xs text-[#717171] mt-2">We confirm your security PIN before requesting a new funding account.</p></div>
      <label className="mt-5 flex gap-3 items-start text-[#667085] text-sm"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} disabled={pending} required className="mt-1"/>
        <span>I authorize {brand.name} to share my verified identity details with the selected bank-account provider to assign an NGN funding account.</span></label>
      <CustomButton disabled={pending || !consent || !validBank || kyc.isError || !/^\d{4}$/.test(pin)} isLoading={pending} className="mt-10 w-full">Proceed - <span className="opacity-60">Create account</span></CustomButton>
    </form>}
    {hasVirtualAccountIntent() && <button type="button" disabled={pending} onClick={resetAttempt} className="text-[#667085] text-xs underline mt-5">Check request status, then start another request</button>}
  </section>;
}
