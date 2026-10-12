import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import CustomButton from '@/components/CustomButton';
import { completePasswordEnrollment, requestPasswordEnrollment } from '@/lib/api/authApi';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function PasswordEnrollmentForm() {
  const [requested,setRequested]=useState(false);
  const [code,setCode]=useState('');
  const [password,setPassword]=useState('');
  const [confirm,setConfirm]=useState('');
  const [pending,setPending]=useState(false);
  const {clearAuthData}=useAuth();
  const navigate=useNavigate();
  async function submit(e:FormEvent) {
    e.preventDefault();if(pending)return;setPending(true);
    try {
      if(!requested) {await requestPasswordEnrollment();setRequested(true);toast.success('A password setup code has been queued for your verified email.');}
      else {if(password!==confirm){toast.error('Passwords do not match.');return;}
        await completePasswordEnrollment({code,password});clearAuthData();toast.success('Password added. Please sign in again.');navigate('/auth/login',{replace:true});}
    }catch{toast.error('Unable to complete password setup. Check your code and try again.');}
    finally{setPending(false);}
  }
  return <section className="mt-5 pt-5 border-t border-[#E9E9E9]" aria-labelledby="password-setup-title">
    <h2 id="password-setup-title" className="text-[#112929] font-semibold text-base">Add an account password</h2>
    <p className="text-sm text-[#667085] mt-2">You use Google to sign in. Add a password to manage your authenticator and transaction PIN. We’ll verify your email first.</p>
    <form onSubmit={submit} className="mt-3 space-y-3">
      {requested && <>
        <label htmlFor="password-setup-code" className="block text-sm text-[#344054]">8-digit email code</label>
        <input id="password-setup-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={8} pattern="[0-9]{8}" value={code} onChange={e=>setCode(e.target.value)} required className="w-full border border-[#D0D5DD] rounded-md p-3" />
        <label htmlFor="password-setup-new" className="block text-sm text-[#344054]">New password</label>
        <input id="password-setup-new" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} required className="w-full border border-[#D0D5DD] rounded-md p-3" />
        <label htmlFor="password-setup-confirm" className="block text-sm text-[#344054]">Confirm password</label>
        <input id="password-setup-confirm" type="password" autoComplete="new-password" minLength={12} maxLength={128} value={confirm} onChange={e=>setConfirm(e.target.value)} required className="w-full border border-[#D0D5DD] rounded-md p-3" />
      </>}
      <CustomButton disabled={pending || (requested && (code.length!==8 || password.length<12 || password!==confirm))} isLoading={pending} className="w-full">{requested?'Create password':'Send setup code'}</CustomButton>
    </form>
  </section>;
}
