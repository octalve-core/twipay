import { QueryFunction } from "@tanstack/react-query";
import api from "../axios";
import { TIntCountry } from "@/components/dashboard/services/international-airtime/RecipientDetails";

export interface TransactionHistoryResponse {
  message: string;
  data: Transaction[];
  pagination: Pagination;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

type TransactionMetadata = {
  provider: string;
  recipientName?: string;
  recipientId?: string;
  transferId?: string;
  senderUsername?: string;
  senderEmail?: string;

  accountNumber?: string;
  accountName?: string;
  bankName?: string;

  phone?: string;
  serviceName?: string;
  serviceCode?: string;
  network?: string;
  logo?: string;
  providerReference?: string;
  customerId?: string;
  smartCardNumber?: string;
  profileId?: string;
  productName?: string;
  subscriptionType?: string;
  meterNumber?: string;
  meterType?: string;
  token?: string;

  country?: TIntCountry,

  originalReference?: string;
  reason?: string;

  remark?: string;
}

export interface Transaction {
  id: string;
  reference: string;
  amount: number;
  direction: "DEBIT" | "CREDIT";
  type:
    | "wallet_transfer"
    | "airtime"
    | "refund"
    | "gift_card_purchase"
    | string;
  status: "success" | "failed" | "pending" | string;
  purpose: string;
  provider: string;
  description: string;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
  updatedAt: string;
  metadata: TransactionMetadata;
}


// ********************************** //

export interface CountryData {
  id: number;
  name: string;
  code: string;
  iso2: string;
  iso3: string;
  phone_code: string;
  region: string;
  emoji: string;
  emoji_code: string;
  capital: string;
  currency: string;
  currency_name: string;
  currency_symbol: string;
  longitude: string;
  latitude: string;
  flag_url: string;
  can_do_airtime: boolean;
  airtime_activated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  code: string;
  logo: string;
  name: string;
  type: string;
  amount: number;
}

export type Customer = {
  phone?: string;
  smartcard_number?: string;
  meter_name?: string;
  meter_type?: string;
  meter_number?: string;
  meter_address?: string;
  registration_number?: string;
  customer_id?: string;
};

export interface Discount {
  id: number;
  code: string;
  name: string;
  type: string;
  value: number;
  active: boolean;
  created_at: string;
  product_type: string;
}

export interface Provider {
  id: number;
  code: string;
  logo: string;
  name: string;
  active: boolean;
  product_type: string[];
  supported_product_types: string[];
}

type UserWallet = {
  type: string;
  balance: number;
};

type UserData = {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  phone_code: string;
  phone: string;
  username: string;
  gender: string;
  ref_code: string;
  avatar: string | null;
  country: string;
  state: string;
  status: string;
  is_blacklisted: boolean;
  auth_type: string;
  type: string;
  referral_earning_rate: number;
  bvn_verified: boolean;
  bvn_validated: boolean;
  bvn: string | null;
  nin_verified: boolean;
  nin_validated: boolean;
  nin: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  two_factor_enabled: boolean;
  pin_activated: boolean;
  login_biometric_activated: boolean;
  transaction_biometric_activated: boolean;
  created_at: string;
  last_login_at: string;
  last_login_ip_address: string;
  wallet: UserWallet;
  country_data: CountryData;
};

export type TransactionDetails = {
  id: string;
  ip_address: string;
  reference: string;
  provider_reference: string | null;
  provider_amount: number;
  amount: number;
  discount: number;
  fee: number;
  total_amount: number;
  profit: number;
  type: string;
  provider: string;
  remark: string;
  purpose: string;
  status: string;
  meta: TransactionMetadata;
  created_at: string;
  balance_before: number;
  balance_after: number | null;
  proof: string | null;
  review_proof: string | null;
  user: UserData;
};


type TParams = {
  page?: number;
  per_page: number;
  status?: string;
  startDate?: string;
  endDate?: string;
  startPrice?: string; 
  endPrice?: string; 
  type?: string;
}

export const ITEMS_PER_PAGE = 50;

export const getTxnHistory = async ({page, per_page, status, startDate, endDate,  startPrice, endPrice, type}: TParams): Promise<TransactionHistoryResponse> => {
  const queryParams: Record<string, string | number | undefined> = {
        page,
      }

  if(per_page) queryParams["limit"] = per_page;
  if (type) queryParams["type"] = type;
  if(status) queryParams["status"] = status;
  if (startPrice) queryParams["startPrice"] = startPrice;
  if (endPrice) queryParams["endPrice"] = endPrice;
  
  if (startDate) queryParams["startDate"] = startDate;
  if (endDate) queryParams["endDate"] = endDate;

  const res = await api.get("/transactions", {
    params: queryParams
  })
  return res.data;
}

export const getTxnHistoryDetail: QueryFunction<Transaction, [_: string, transactionId: string]> = async ({
  queryKey,
}) => {
  const [, transactionId] = queryKey;
  const res = await api.get(`/transactions/${transactionId}`);
  return res.data.data;
};