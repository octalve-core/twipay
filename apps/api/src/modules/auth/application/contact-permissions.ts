/** Initial dashboard access is independent of User.status, KYC, MFA and transaction PIN. */
export function contactVerified(user: {
  emailVerifiedAt: Date | null;
  phoneE164: string | null;
  phoneVerifiedAt: Date | null;
}): boolean {
  return Boolean(user.emailVerifiedAt || (user.phoneE164 && user.phoneVerifiedAt));
}
