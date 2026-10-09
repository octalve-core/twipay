import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import GoogleIcon from '@/assets/auth/google-icon.png';
import { getGoogleAvailability, startGoogleSignIn } from '@/lib/api/authApi';
import CustomButton from '../CustomButton';

/** Google authorization happens on TwiPay's backend, never through Firebase or browser token storage. */
export default function GoogleLoginButton({ disabled = false }: { disabled?: boolean }) {
  const [available, setAvailable] = useState(false);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    let active = true;
    void getGoogleAvailability().then((status) => { if (active) setAvailable(status.enabled); }).catch(() => {});
    return () => { active = false; };
  }, []);
  if (!available) return null; // Do not market an unconfigured authentication method as working.

  const begin = async () => {
    if (pending || disabled) return;
    setPending(true);
    try {
      const { authorizationUrl } = await startGoogleSignIn();
      // Full navigation to Google's authorization endpoint; cookies remain HttpOnly.
      window.location.assign(authorizationUrl);
    } catch {
      setPending(false);
      toast.error('Google sign-in is temporarily unavailable. Please try your email and password.');
    }
  };
  return <CustomButton onClick={() => void begin()} disabled={disabled || pending} type="button" variant="primary" className="flex items-center justify-center gap-3 mt-5 w-full border border-[#D0D5DD]">
    <img src={GoogleIcon} alt="" className="size-6" />
    <span>Continue with Google</span>
  </CustomButton>;
}
