import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { ReactNode } from 'react';

/** Shares the dashboard's session/MFA boundary for standalone customer financial views. */
export default function AuthenticatedCustomerRoute({children}: {children: ReactNode}) {
  const {loading, user, mfaRequired} = useAuth();
  if (loading) return <main role="status" className="min-h-screen grid place-items-center bg-[#F9FAFB] text-[#667085]">Checking your session…</main>;
  if (!user) return <Navigate to="/auth/login" replace />;
  if (mfaRequired) return <Navigate to="/auth/two-factor-authentication" replace />;
  if (!user.contactVerified) return <Navigate to="/auth/verify-email" replace />;
  return <>{children}</>;
}
