import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import CustomButton from '@/components/CustomButton';
import { completePinReset, requestPinReset } from '@/lib/api/authApi';
import { useAuth } from '@/context/AuthContext';

export default function ResetTxnPinForm({closeModal}: {closeModal:()=>void}) {
  const [password,setPassword]=useState('');
  const [code,setCode]=useState('');
  const [pin,setPin]=useState('');
  const [requested,setRequested]=useState(false);
  const [pending,setPending]=useState(false);
  const {refreshSession}=useAuth();
  async function submit(e:FormEvent) {
    e.preventDefault(); if(pending)return;setPending(true);
    try {
      if(!requested) {
        await requestPinReset(password);
        setRequested(true);
        toast.success('If approved, a reset code is queued for your verified email.');
      } else {
        await completePinReset({password,code,newPin:pin});
        setPassword('');setCode('');setPin('');await refreshSession();
        toast.success('Your transaction PIN has been reset.');closeModal();
      }
    } catch {toast.error('Unable to reset your PIN. Check your details and try again.');}
    finally {setPending(false);}
  }
  return <form className="w-full space-y-4" onSubmit={submit}>
    <p className="text-[#475467] text-sm">We’ll confirm your password and send a one-time code to your verified email address. This does not authorize any transaction.</p>
    <label className="block text-sm text-[#344054]" htmlFor="pin-reset-password">Account password</label>
    <input id="pin-reset-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required className="w-full rounded-md border border-[#D0D5DD] p-3" />
    {requested && <>
      <label className="block text-sm text-[#344054]" htmlFor="pin-reset-code">8-digit email code</label>
      <input id="pin-reset-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={8} pattern="[0-9]{8}" value={code} onChange={e=>setCode(e.target.value)} required className="w-full rounded-md border border-[#D0D5DD] p-3" />
      <label className="block text-sm text-[#344054]" htmlFor="pin-reset-new">New 4-digit PIN</label>
      <input id="pin-reset-new" type="password" inputMode="numeric" autoComplete="off" maxLength={4} pattern="[0-9]{4}" value={pin} onChange={e=>setPin(e.target.value)} required className="w-full rounded-md border border-[#D0D5DD] p-3" />
    </>}
    <CustomButton disabled={pending || !password || (requested && (code.length!==8 || pin.length!==4))} isLoading={pending} className="w-full">{requested?'Reset PIN':'Send reset code'}</CustomButton>
  </form>;
}
