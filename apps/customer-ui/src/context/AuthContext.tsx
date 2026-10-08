import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getCurrentSession, GetMfaStatus, type TwiPayAuthUser } from "@/lib/api/authApi";

// Legacy presentational fields are retained temporarily; only TwiPay /auth/me establishes identity.
export type User = {
  id: string; firstname: string; lastname: string; username: string; email: string;
  authType: "password" | "google" | "apple"; avatar: string | null;
  phone: string; phoneCode: string; country: string; state: string;
  gender: "male" | "female" | "other"; dateOfBirth: string | null;
  status: "active" | "inactive" | "suspended"; refCode: string; referredBy: string | null;
  bvnValidated: boolean; bvnVerified: boolean; emailVerifiedAt: string | null; phoneVerifiedAt: string | null;
  twofactorEnabled: boolean; twoFactorEnabledAt: string | null;
  loginBiometricEnabled: boolean; transactionBiometricEnabled: boolean; pinActivatedAt: string | null;
  lastLoginAt: string | null; fcmTokens: string[]; virtualAccount: unknown | null; createdAt: string; updatedAt: string;
};
function toViewUser(value: TwiPayAuthUser): User {
  return {id:value.id, firstname:value.givenName??"", lastname:value.familyName??"", username:value.givenName??"", email:value.email,
    authType:"password", avatar:null, phone:"", phoneCode:"", country:"", state:"", gender:"other", dateOfBirth:null,
    status:value.status === "ACTIVE"?"active":"inactive",refCode:"",referredBy:null,bvnValidated:false,bvnVerified:false,
    emailVerifiedAt:null,phoneVerifiedAt:null,twofactorEnabled:false,twoFactorEnabledAt:null,loginBiometricEnabled:false,
    transactionBiometricEnabled:false,pinActivatedAt:null,lastLoginAt:null,fcmTokens:[],virtualAccount:null,createdAt:"",updatedAt:""};
}
type AuthValue = {
  user: User | null; loading: boolean; mfaRequired: boolean;
  // Temporary compatibility indicators for old UI screens. NOT bearer/refresh credentials.
  accessToken: string | null; refreshToken: string | null;
  refreshSession: () => Promise<void>;
  setAuthData: (_user?: unknown, _oldAccessToken?: string, _oldRefreshToken?: string) => void;
  clearAuthData: () => void;
};
const AuthContext = createContext<AuthValue | undefined>(undefined);
export function AuthContextProvider({children}: {children: ReactNode}) {
  const [user,setUser] = useState<User|null>(null);
  const [loading,setLoading] = useState(true);
  const [mfaRequired,setMfaRequired] = useState(true);
  const refreshSession = useCallback(async () => {
    try {
      const result = await getCurrentSession();
      const status = await GetMfaStatus();
      const required = status.mfa.enabled && !result.mfaSatisfied;
      setMfaRequired(required);
      setUser({...toViewUser(result.user), twofactorEnabled: status.mfa.enabled});
    } catch (error) {setUser(null);setMfaRequired(true);throw error;}
  },[]);
  useEffect(() => {
    let active=true;
    Promise.all([getCurrentSession(), GetMfaStatus()])
      .then(([res,status])=>{
        if(active) {
          setMfaRequired(status.mfa.enabled && !res.mfaSatisfied);
          setUser({...toViewUser(res.user),twofactorEnabled:status.mfa.enabled});
        }
      })
      .catch(()=>{if(active){setUser(null);setMfaRequired(true);}})
      .finally(()=>{if(active)setLoading(false);});
    const invalidated=()=>{setUser(null);setMfaRequired(true);};
    window.addEventListener("twipay:session-invalidated", invalidated);
    return ()=>{active=false;window.removeEventListener("twipay:session-invalidated",invalidated);};
  },[]);
  const setAuthData = useCallback(() => {void refreshSession().catch(()=>{});},[refreshSession]);
  const clearAuthData = useCallback(()=>{setUser(null);setMfaRequired(true);},[]);
  const value = useMemo(()=>({user,loading,mfaRequired,refreshSession,setAuthData,clearAuthData,
    accessToken:user?"SERVER_SESSION_PRESENT":null, refreshToken:null}),[user,loading,mfaRequired,refreshSession,setAuthData,clearAuthData]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => {const value=useContext(AuthContext);if(!value)throw new Error("useAuth requires AuthContextProvider");return value;};
