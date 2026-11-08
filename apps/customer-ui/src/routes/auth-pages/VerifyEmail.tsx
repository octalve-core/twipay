import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { useAuth } from '@/context/AuthContext';
import { verifyEmail, resendOtpFn, Logout } from '@/lib/api/authApi';
import CustomButton from '@/components/CustomButton';
import BackButton from '@/components/Authentication/BackButton';
import Logo from '@/components/navbar/Logo';
import AuthLogomark from '@/assets/auth/AuthLogomark.png';
import { brand } from "@/config/brand";

/** Original ErhaPay OTP controls, without the superseded four-step registration wizard. */
export default function VerifyEmail() {
  const { user, loading, mfaRequired, refreshSession, clearAuthData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const delivery = (location.state as {verificationDelivery?: string} | null)?.verificationDelivery;
  const [code, setCode] = useState('');
  const [resendSeconds, setResendSeconds] = useState(delivery ? 60 : 0);
  const confirm = useMutation({mutationFn: verifyEmail});
  const resend = useMutation({mutationFn: resendOtpFn});

  useEffect(() => {
    if (!resendSeconds) return;
    const timer = window.setTimeout(() => setResendSeconds(v => Math.max(0,v-1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  if (loading) return <main role="status" className="min-h-screen grid place-items-center text-[#667085]">Checking your session…</main>;
  if (!user) return <Navigate to="/auth/login" replace />;
  if (mfaRequired) return <Navigate to="/auth/two-factor-authentication" replace />;
  if (user.contactVerified) return <Navigate to="/dashboard" replace />;

  async function onConfirm(e: FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return;
    try {
      await confirm.mutateAsync(code);
      setCode('');
      await refreshSession();
      toast.success(`You're all set. Welcome to ${brand.name}!`);
      navigate('/dashboard', {replace:true});
    } catch {
      // Clear the rejected code: a full InputOTP only overwrites its last slot, so a pasted new code would be mangled.
      setCode('');
      toast.error('That code is invalid or expired. Please check it or request another.');
    }
  }
  async function onResend() {
    if (resendSeconds || resend.isPending) return;
    try {
      const result = await resend.mutateAsync();
      if (result.deliveryStatus === 'ALREADY_VERIFIED') {
        await refreshSession();
        navigate('/dashboard', {replace:true});
        return;
      }
      setResendSeconds(60);
      toast.success(result.deliveryStatus === 'DELIVERED' ? 'Your new code was delivered.' : result.deliveryStatus === 'ACCEPTED' ? 'Your new code is on its way.' : 'Your new code is being prepared.');
    } catch {
      toast.error('Unable to send another code yet. Please try again shortly.');
    }
  }
  async function signOut() {
    try {
      await Logout();
      clearAuthData();
      navigate('/auth/login', {replace:true});
    } catch {
      toast.error('We couldn’t sign you out. Please try again.');
    }
  }
  return <div className="container flex flex-col items-center md:justify-center px-5 md:px-0 py-10 min-h-screen">
    <div className="w-full max-w-[410px]"><BackButton href="/auth/login" className="max-md:hidden"/><Logo imgClassName="w-[91.5px] h-10 md:hidden" /></div>
    <img src={AuthLogomark} alt="" aria-hidden="true" className="object-cover size-8 mb-1.5 mt-6 max-md:hidden" />
    <div className="md:text-center max-md:mt-10">
      <h1 className="text-4xl text-[#101828] font-medium">Check your email to continue</h1>
      <p className="mt-3 text-[#475467]">Enter the six-digit verification code for <strong>{user.email}</strong>. Codes are valid for 10 minutes.</p>
      {delivery === 'PENDING' && <p role="status" className="text-sm text-[#667085] mt-3">Your verification message is being prepared. You can request a fresh code below.</p>}
    </div>
    <form onSubmit={onConfirm} className="w-full max-w-[410px] mt-8">
      <label htmlFor="email-otp" className="block text-sm font-medium text-[#344054] mb-2">Verification code</label>
      <InputOTP id="email-otp" pattern={REGEXP_ONLY_DIGITS} maxLength={6} value={code} onChange={setCode}>
        <InputOTPGroup className="flex gap-1.5 md:gap-3 justify-between md:justify-center w-full">
          {Array.from({length:6}).map((_,i)=><InputOTPSlot key={i} index={i} className="border !rounded-md size-12 text-4xl text-[#667085] font-medium"/>)}
        </InputOTPGroup>
      </InputOTP>
      <div className="mt-10 mb-6 text-center">
        <button type="button" onClick={onResend} disabled={resendSeconds>0 || resend.isPending || confirm.isPending} className="text-[#4F044F] cursor-pointer hover:opacity-80 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#112929] rounded-sm">Resend code</button>
        {resendSeconds>0 && <span className="text-[#667085]"> in {resendSeconds}s</span>}
      </div>
      <CustomButton isLoading={confirm.isPending} disabled={code.length!==6 || confirm.isPending || resend.isPending} className="w-full">Verify and continue</CustomButton>
      <button type="button" onClick={signOut} className="block mx-auto mt-5 text-sm text-[#475467] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[#112929]">Use a different account</button>
    </form>
  </div>;
}
