import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import Loader from '@/components/Loader';

/** The old compulsory onboarding PIN wizard is retired.
 * All PIN credential changes now live in the authenticated ErhaPay security settings. */
export default function SetTransactionPin() {
  const { user, loading, mfaRequired } = useAuth();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/auth/login" replace />;
  if (!user.contactVerified) return <Navigate to="/auth/verify-email" replace />;
  if (mfaRequired) return <Navigate to="/auth/two-factor-authentication" replace />;
  return <Navigate to="/dashboard/settings/security" replace />;
}
