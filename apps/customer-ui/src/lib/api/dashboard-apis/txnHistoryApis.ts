import type { QueryFunction } from "@tanstack/react-query";
import api from "../axios";
import { formatNgnMinorUnits } from "@/lib/money";

/** TwiPay finance API uses integer kobo strings; do not convert to JS Number. */
export type Transaction = {
  id: string;
  reference: string;
  amountMinor: string;
  feeMinor: string;
  amount: string; // exact decimal major units, for legacy display-only UI
  direction: "DEBIT" | "CREDIT" | "NEUTRAL";
  type: string;
  status: string;
  purpose: string;
  provider: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  metadata: {
    provider?: string; bankCode?: string; recipientName?: string; recipientId?: string; transferId?: string;
    senderUsername?: string; senderEmail?: string; accountNumber?: string;
    accountName?: string; bankName?: string; phone?: string;
    serviceName?: string; serviceCode?: string; network?: string; logo?: string;
    providerReference?: string; customerId?: string; smartCardNumber?: string;
    profileId?: string; productName?: string; subscriptionType?: string;
    meterNumber?: string; meterType?: string; token?: string;
    country?: {currencySymbol: string}; originalReference?: string; reason?: string; remark?: string;
  };
};

export type Pagination = {total: number; page: number; limit: number; totalPages: number; hasNext: boolean; hasPrev: boolean};
export type TransactionHistoryResponse = {data: Transaction[]; pagination: Pagination};
type RawTransaction = {
  reference: string; type: string; status: string; currency: string;
  amountMinor: string; feeMinor: string; description?: string | null;
  provider?: string | null; createdAt: string; updatedAt: string;
  beneficiary?: {bankCode: string; accountNumber: string; accountName: string} | null;
};
const typeLabels: Record<string, string> = {
  FUNDING: "wallet_funding", TRANSFER: "wallet_transfer", BILL_PAYMENT: "bill_payment",
  EVENT_PURCHASE: "event_purchase", REFUND: "refund", REVERSAL: "reversal",
  FEE: "fee", ADJUSTMENT: "adjustment", ORGANIZER_PAYOUT: "organizer_payout",
};
const statusLabels: Record<string, string> = {
  SUCCEEDED: "success", FAILED: "failed", REVERSED: "reversed", CANCELLED: "cancelled",
  UNKNOWN: "unknown", PROCESSING: "processing", CREATED: "pending", AUTHORIZED: "pending",
  FUNDS_RESERVED: "pending", PROVIDER_SUBMITTED: "processing",
};
const integerMinor = /^(0|[1-9]\d*)$/;
const allowedStatuses = new Set(Object.keys(statusLabels));
export function adaptTransaction(raw: RawTransaction): Transaction {
  if (!raw || typeof raw.reference !== "string" || !/^[A-Za-z0-9._:-]{1,80}$/.test(raw.reference)
      || raw.currency !== "NGN" || !typeLabels[raw.type] || !allowedStatuses.has(raw.status)
      || !integerMinor.test(raw.amountMinor) || !integerMinor.test(raw.feeMinor)
      || !Number.isFinite(Date.parse(raw.createdAt)) || !Number.isFinite(Date.parse(raw.updatedAt))) {
    throw new TypeError("Unexpected TwiPay transaction data");
  }
  const minor = BigInt(raw.amountMinor);
  const amount = `${minor / 100n}.${(minor % 100n).toString().padStart(2, "0")}`;
  const type = typeLabels[raw.type];
  const direction: Transaction["direction"] = ["FUNDING", "REFUND"].includes(raw.type) ? "CREDIT"
    : ["TRANSFER", "BILL_PAYMENT", "EVENT_PURCHASE", "FEE", "ORGANIZER_PAYOUT"].includes(raw.type) ? "DEBIT" : "NEUTRAL";
  return {
    id: raw.reference, reference: raw.reference, amountMinor: raw.amountMinor, feeMinor: raw.feeMinor, amount,
    direction, type, status: statusLabels[raw.status], purpose: type.replace(/^wallet_/, ""),
    provider: raw.provider ?? "", description: raw.description?.trim() || type.replaceAll("_", " "),
    createdAt: raw.createdAt, updatedAt: raw.updatedAt,
    metadata: {
      ...(raw.provider ? {provider: raw.provider} : {}),
      ...(raw.beneficiary ? {accountNumber: raw.beneficiary.accountNumber, accountName: raw.beneficiary.accountName, recipientName: raw.beneficiary.accountName, bankCode: raw.beneficiary.bankCode} : {}),
    },
  };
}
export function formatTransactionAmount(transaction: Transaction): string {
  return formatNgnMinorUnits(transaction.amountMinor);
}
const pageNumber = (value: number) => Number.isSafeInteger(value) && value >= 1 && value <= 10000;
const pageLimit = (value: number) => Number.isSafeInteger(value) && value >= 1 && value <= 100;
/** Convert a decimal naira filter to kobo exactly, never using parseFloat. */
export function amountFilterToMinor(value: string): string {
  if (!/^(0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(value)) throw new TypeError("Invalid NGN amount filter");
  const [integer, fraction = ""] = value.split(".");
  return (BigInt(integer) * 100n + BigInt(fraction.padEnd(2, "0"))).toString();
}
export const ITEMS_PER_PAGE = 50;
type Params = {page?: number; per_page: number; status?: string; startDate?: string; endDate?: string; startPrice?: string; endPrice?: string; type?: string};
const uiStatuses: Record<string, string> = {success:"SUCCEEDED", successful:"SUCCEEDED", failed:"FAILED", pending:"PENDING", processing:"IN_FLIGHT", unknown:"UNKNOWN", reversed:"REVERSED", cancelled:"CANCELLED"};
const uiTypes: Record<string, string> = Object.fromEntries(Object.entries(typeLabels).map(([key, value]) => [value, key]));
export const getTxnHistory = async (params: Params): Promise<TransactionHistoryResponse> => {
  const page = params.page ?? 1;
  if (!pageNumber(page) || !pageLimit(params.per_page)) throw new TypeError("Invalid page request");
  const query: Record<string,string|number> = {page, limit: params.per_page};
  if (params.status) {
    if (!uiStatuses[params.status]) throw new TypeError("Unsupported transaction status filter");
    query.status = uiStatuses[params.status];
  }
  if (params.type) {
    if (!uiTypes[params.type]) throw new TypeError("Unsupported transaction type filter");
    query.type = uiTypes[params.type];
  }
  if (params.startDate) query.startDate = params.startDate;
  if (params.endDate) query.endDate = params.endDate;
  if (params.startPrice) query.minAmountMinor = amountFilterToMinor(params.startPrice);
  if (params.endPrice) query.maxAmountMinor = amountFilterToMinor(params.endPrice);
  const res = await api.get<{transactions: RawTransaction[]; pagination: Pagination}>("/transactions", {params: query});
  if (!Array.isArray(res.data.transactions) || !res.data.pagination
      || !Number.isSafeInteger(res.data.pagination.total) || !pageNumber(res.data.pagination.page)
      || !pageLimit(res.data.pagination.limit) || !Number.isSafeInteger(res.data.pagination.totalPages)
      || typeof res.data.pagination.hasNext !== "boolean" || typeof res.data.pagination.hasPrev !== "boolean") {
    throw new TypeError("Unexpected TwiPay transaction history response");
  }
  return {data: res.data.transactions.map(adaptTransaction), pagination: res.data.pagination};
};
export const getTxnHistoryDetail: QueryFunction<Transaction, [string, string]> = async ({queryKey}) => {
  const reference = queryKey[1];
  if (!/^[A-Za-z0-9._:-]{1,80}$/.test(reference)) throw new TypeError("Invalid transaction reference");
  const res = await api.get<{transaction: RawTransaction | null}>(`/transactions/${encodeURIComponent(reference)}`);
  if (!res.data.transaction) throw new Error("Transaction not found or not available to this account");
  return adaptTransaction(res.data.transaction);
};
