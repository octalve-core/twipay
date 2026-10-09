import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { ReactNode } from 'react';

/** Route-level UX guard; backend still verifies the session, MFA code and CSRF. */
export default function MfaChallengeRoute({children}: {children: ReactNode}) {
  const {loading, user, mfaRequired} = useAuth();
  if (loading) return <main role="status" className="min-h-screen grid place-items-center bg-[#F9FAFB] text-[#667085]">Checking your session…</main>;
  if (!user) return <Navigate to="/auth/login" replace />;
  if (!mfaRequired) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
