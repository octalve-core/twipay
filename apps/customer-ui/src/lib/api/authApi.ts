import api from "./axios";
import type { TFormData as SignUpFormData } from "@/components/Authentication/SignUpForm";

type Profile = { id: string; email: string; givenName: string | null; familyName: string | null; status: string;
  emailVerifiedAt?: string | null; phoneVerifiedAt?: string | null; contactVerified?: boolean;
  identityVerificationStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'VERIFIED'; transactionPinStatus?: 'NOT_AVAILABLE' | 'NOT_SET' | 'SET'; };
export type TwiPayAuthUser = Profile;

export const SignUpUser = async (payload: SignUpFormData) => {
  if (payload.referralCode?.trim()) throw new Error("Referral enrollment is not yet available");
  const response = await api.post<{user: Profile; csrfToken: string; verificationDelivery: "PENDING" | "ACCEPTED" | "DELIVERED"}>("/auth/register", {
    email: payload.email, password: payload.password, givenName: payload.firstname, familyName: payload.lastname,
  });
  return response.data;
};
export const LogInUser = async ({payload}: {payload: {email?: string; password?: string}}) => {
  const response = await api.post<{user: Profile; csrfToken: string}>("/auth/login", payload);
  return response.data;
};
export const Logout = async () => (await api.post<{ok: boolean}>("/auth/logout")).data;
export const getCurrentSession = async () => (await api.get<{user: Profile; mfaSatisfied: boolean}>("/auth/me")).data;
export const getUser = async () => (await getCurrentSession()).user;
export const GetMfaStatus = async () => (await api.get<{mfa: {enabled: boolean}}>("/auth/mfa/status")).data;
export const verify2FaOtp = async ({otp}: {otp: string}) => (await api.post("/auth/mfa/challenge", {code: otp})).data;

// The following legacy ErhaPay API calls are deliberately disabled pending typed TwiPay contracts.
function unavailable(): never { throw new Error("This account workflow is not yet integrated with TwiPay"); }
export const SignInWithGoogle = async (_value?: unknown): Promise<any> => unavailable();
export const resend2FaOtp = async (_value?: unknown): Promise<any> => unavailable();
export const verifyEmail = async (code: string) => (await api.post<{verified: boolean}>("/auth/contact/email/confirm", {code})).data;
export const resendOtpFn = async () => (await api.post<{deliveryStatus: 'DELIVERED' | 'ACCEPTED' | 'PENDING' | 'ALREADY_VERIFIED'}>("/auth/contact/email/resend")).data;
export const fetchCountries = async (): Promise<any> => unavailable();
export type TwiPayProfileUpdate = { givenName?: string | null; familyName?: string | null };
export const updateProfile = async (profile: TwiPayProfileUpdate): Promise<Profile> => {
  const response = await api.patch<{ user: Profile }>("/auth/me", profile);
  return response.data.user;
};
export const sendPhoneCode = async (_value?: unknown): Promise<any> => unavailable();
export const verifyPhoneNo = async (_value?: unknown): Promise<any> => unavailable();
export const setTransactionPin = async (_value?: unknown): Promise<any> => unavailable();
export const changeTransactionPin = async (_value?: unknown): Promise<any> => unavailable();
export const resendPasswordOtp = async (email: string): Promise<{ok: boolean}> =>
  (await api.post<{ok: boolean}>('/auth/password/reset/request', {email})).data;
// Recovery code is verified and consumed atomically with the password update.
export const setNewPassword = async (input: {email: string; token: string; password: string}): Promise<{ok: boolean}> =>
  (await api.post<{ok: boolean}>('/auth/password/reset/complete', {email: input.email, code: input.token, newPassword: input.password})).data;
export const listAccountSessions = async (): Promise<{sessions: Array<{id: string; current: boolean; userAgent: string | null; createdAt: string; lastSeenAt: string; expiresAt: string}>}> =>
  (await api.get('/auth/sessions')).data;
export const revokeOtherAccountSessions = async (currentPassword: string): Promise<{revoked: number}> =>
  (await api.post('/auth/sessions/revoke-others', {currentPassword})).data;
export const deactivateAccount = async (): Promise<any> => unavailable();

// The existing NestJS MFA controller owns password re-authentication, TOTP
// verification, recovery-code hashing, credential state and session rotation.
export type MfaStatus = {
  enabled: boolean;
  enabledAt: string | null;
  recoveryCodesRemaining: number;
  enrollmentPending: boolean;
  enrollmentStartedAt: string | null;
};
export type MfaEnrollment = {
  credentialId: string;
  manualSecret: string;
  otpauthUri: string;
  expiresAt: string;
};
export const beginMfaEnrollment = async (password: string): Promise<MfaEnrollment> =>
  (await api.post<{enrollment: MfaEnrollment}>("/auth/mfa/enroll", {password})).data.enrollment;
export const confirmMfaEnrollment = async (code: string): Promise<readonly string[]> =>
  (await api.post<{recoveryCodes: string[]}>("/auth/mfa/enroll/confirm", {code})).data.recoveryCodes;
export const regenerateMfaRecoveryCodes = async (code: string): Promise<readonly string[]> =>
  (await api.post<{recoveryCodes: string[]}>("/auth/mfa/recovery-codes/regenerate", {code})).data.recoveryCodes;
export const disableMfa = async (code: string): Promise<void> => {
  await api.post("/auth/mfa/disable", {code, reason: "USER_DISABLED"});
};
