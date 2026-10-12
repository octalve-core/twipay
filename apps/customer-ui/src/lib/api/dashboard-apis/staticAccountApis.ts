import api from "../axios"

// interface Wallet {
//   type: string;
//   balance: number;
// }

// interface CountryData {
//   id: number;
//   name: string;
//   code: string;
//   iso2: string;
//   iso3: string;
//   phone_code: string;
//   region: string;
//   emoji: string;
//   emoji_code: string;
//   capital: string;
//   currency: string;
//   currency_name: string;
//   currency_symbol: string;
//   longitude: string;
//   latitude: string;
//   flag_url: string;
//   can_do_airtime: boolean;
//   airtime_activated_at: string | null;
//   created_at: string;
// }

// interface User {
//   id: number;
//   firstname: string;
//   lastname: string;
//   email: string;
//   phone_code: string;
//   phone: string;
//   username: string;
//   gender: string;
//   ref_code: string;
//   avatar: string | null;
//   country: string;
//   state: string;
//   status: string;
//   is_blacklisted: boolean;
//   auth_type: string;
//   type: string;
//   referral_earning_rate: number;
//   bvn_verified: boolean;
//   bvn_validated: boolean;
//   bvn: string;
//   nin_verified: boolean;
//   nin_validated: boolean;
//   nin: string | null;
//   email_verified: boolean;
//   phone_verified: boolean;
//   two_factor_enabled: boolean;
//   pin_activated: boolean;
//   login_biometric_activated: boolean;
//   transaction_biometric_activated: boolean;
//   created_at: string;
//   last_login_at: string;
//   last_login_ip_address: string;
//   wallet: Wallet;
//   country_data: CountryData;
// }

interface ResponseData {
  identityId: string;
  step: string;
  expiresIn: string;
  nextStep: string;
}

export interface VerificationStatusResponse {
  message: string;
  data: ResponseData;
}

export interface StaticAccount {
  hasAccount: boolean;
  account: {
      accountNumber: string;
      accountName: string;
      bankName: string;
      provider: string;
      createdAt: string;
  };

}

export const validateIdentity = async (params: {value: string; dateOfBirth: string; firstname: string; lastname: string; identificationType?: string}): Promise<VerificationStatusResponse> => {
   const response = await api.post("/wallet/accounts/initiate", {...params, identificationType: "bvn"});
   return response.data;
}

export const validateIdentityOtp = async (params: {identityId: string, otp: string; identificationType?: string}) => {
   const response = await api.post("/wallet/accounts/verify", {...params, identificationType: "bvn"});
   return response.data;
}

export const checkValidityStatus = async (): Promise<VerificationStatusResponse> => {
   const response  = await api.get("/identity/check-status/bvn");
   return response.data;
}

export const generateStaticAccount = async (): Promise<StaticAccount> => {
   const response  = await api.post("/wallet/account/generate");
   return response.data.data;
}

export const getStaticAccount = async (): Promise<StaticAccount> => {
   const response  = await api.get("/wallet/accounts");
   return response.data.data;
}