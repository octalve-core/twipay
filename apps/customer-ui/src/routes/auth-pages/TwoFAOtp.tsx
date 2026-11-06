import CustomButton from "@/components/CustomButton";
import { useNavigate } from "react-router-dom";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { REGEXP_ONLY_DIGITS_AND_CHARS } from "input-otp";
import { FormEvent, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { getCurrentSession, verify2FaOtp } from "@/lib/api/authApi";
import BackButton from "@/components/Authentication/BackButton";
import Logo from "@/components/navbar/Logo";
import AuthLogomark from "@/assets/auth/AuthLogomark.png";
import { brand } from "@/config/brand";

export default function TwoFAOtp() {
  const [otp, setOtp] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const {refreshSession} = useAuth();
  const navigate = useNavigate();
  const {mutateAsync, isPending} = useMutation({mutationFn: verify2FaOtp});
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (useRecovery ? !/^[A-Z2-7-]{16,32}$/i.test(otp.trim()) : !/^\d{6}$/.test(otp)) return;
    try {
      await mutateAsync({otp});
      await refreshSession();
      const session = await getCurrentSession();
      setOtp("");
      navigate(session.user.contactVerified ? "/dashboard" : "/auth/verify-email", {replace: true});
    } catch {
      if (!useRecovery) setOtp(""); // a full InputOTP only overwrites its last slot, so clear the rejected code
      toast.error("Invalid or expired authenticator/recovery code");
    }
  }
  return (
    <div className="container flex flex-col items-center md:justify-center px-5 md:px-0 py-10 min-h-screen">
      <div className="w-full max-w-[410px]">
        <BackButton href="/auth/login" className="max-md:hidden" />
        <Logo imgClassName="w-[91.5px] h-10 md:hidden" />
      </div>
      <img src={AuthLogomark} alt="" className="object-cover size-8 mb-1.5 mt-6 max-md:hidden" />
      <div className="md:text-center max-md:mt-10">
        <h1 className="text-4xl text-[#101828] font-medium">2 factor authentication</h1>
        <p className="mt-3 text-[#475467]">{useRecovery ? "Enter one of your unused recovery codes." : "Enter the current 6-digit code from your authenticator app."}</p>
      </div>
      <form onSubmit={onSubmit} className="w-full max-w-[410px] mt-8">
        {useRecovery ? (
          <label className="block text-sm text-[#344054]" htmlFor="mfa-recovery-code">Recovery code
            <input id="mfa-recovery-code" type="text" autoComplete="off" value={otp} maxLength={32} onChange={e => setOtp(e.target.value)} className="block mt-2 w-full rounded-md border border-[#D0D5DD] p-3 font-mono" />
          </label>
        ) : (
          <InputOTP pattern={REGEXP_ONLY_DIGITS_AND_CHARS} maxLength={6} value={otp} onChange={setOtp}>
            <InputOTPGroup className="flex gap-1.5 md:gap-3 justify-between md:justify-center w-full">
              {Array.from({length: 6}).map((_, i) =>
                <InputOTPSlot key={i} index={i} className="border !rounded-md size-12 text-4xl text-[#667085] font-medium" />)}
            </InputOTPGroup>
          </InputOTP>
        )}
        <button type="button" onClick={() => {setUseRecovery(value => !value); setOtp("");}} className="block mt-4 text-sm text-[#112929] underline">
          {useRecovery ? "Use authenticator code instead" : "Use a recovery code"}
        </button>
        <p className="text-[#667085] text-sm mt-6 text-center">{brand.name} never sends authenticator-app codes by email.</p>
        <CustomButton isLoading={isPending} disabled={(useRecovery ? !/^[A-Z2-7-]{16,32}$/i.test(otp.trim()) : !/^\d{6}$/.test(otp)) || isPending} className="w-full mt-6">Verify and continue</CustomButton>
      </form>
    </div>
  );
}
