import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { brand } from "@/config/brand";

/** No authorization code, provider token, or OAuth state is ever passed into this React route. */
export default function GoogleComplete() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const [failed, setFailed] = useState(params.get('google') !== 'ok');
  useEffect(() => {
    if (params.get('google') !== 'ok') return;
    let active = true;
    void (async () => {
      try {
        await refreshSession();
        const { getCurrentSession, GetMfaStatus } = await import('@/lib/api/authApi');
        const [session, mfa] = await Promise.all([getCurrentSession(), GetMfaStatus()]);
        if (!active) return;
        navigate(mfa.mfa.enabled && !session.mfaSatisfied ? '/auth/two-factor-authentication'
          : !session.user.contactVerified ? '/auth/verify-email' : '/dashboard', { replace: true });
      } catch { if (active) setFailed(true); }
    })();
    return () => { active = false; };
  }, [params, navigate, refreshSession]);
  return <main className="max-w-[360px] mx-auto px-6 py-16" role="status">
    <h1 className="text-3xl font-medium text-[#101828]">{failed ? 'Google sign-in not completed' : 'Finishing your sign-in…'}</h1>
    {failed && <p className="mt-4 text-[#475467]">{params.get('google') === 'link_required'
      ? `This email already has a ${brand.name} account. Please sign in with your existing method and connect Google from Security settings.`
      : 'We couldn’t complete Google sign-in. You can try again or use your email and password.'}</p>}
    {failed && <Link className="inline-block mt-5 text-[#112929] font-medium underline" to="/auth/login">Return to log in</Link>}
  </main>;
}
