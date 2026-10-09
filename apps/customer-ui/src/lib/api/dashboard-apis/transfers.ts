/** Batch C3 — sandbox-only external bank transfers. The API owns all money movement. */
import api from '../axios';
import { nairaToMinor } from './funding';

export type PayoutProvider = 'paystack' | 'monnify';
export type VerifiedBankAccount = {
  providerCode: PayoutProvider;
  bankCode: string;
  accountNumber: string; // the API only returns a masked account number
  accountName: string;
  bankName?: string;
  currency: 'NGN';
};
export type TransferIntent = {
  provider: PayoutProvider;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  amountNaira: string;
  narration: string;
};
export type BankPayoutResponse = {
  transactionReference: string;
  provider: PayoutProvider;
  status: 'PENDING' | 'REQUIRES_ACTION' | 'PROCESSING' | 'UNKNOWN' | 'SUCCEEDED' | 'FAILED' | 'REVERSED';
  amountMinor?: string;
  feeMinor?: string;
  totalDebitMinor?: string;
  currency?: 'NGN';
  beneficiary?: {bankCode: string;accountNumber:string;accountName:string};
  code?: string;
};
const INTENT_STORAGE_KEY = 'twipay:bank-payout-intent:v1';
const MAX_MINOR = 9007199254740991n;
const UUID_PATTERN = /^twipay-payout:[0-9a-f-]{36}$/;
const statuses = new Set(['PENDING','REQUIRES_ACTION','PROCESSING','UNKNOWN','SUCCEEDED','FAILED','REVERSED']);
const validProvider = (value: unknown): value is PayoutProvider => value === 'paystack' || value === 'monnify';

function details(input: TransferIntent) {
  const amountMinor = nairaToMinor(input.amountNaira);
  if (BigInt(amountMinor) > MAX_MINOR || !validProvider(input.provider)
    || !/^[A-Za-z0-9_-]{2,20}$/.test(input.bankCode)
    || !/^\d{10}$/.test(input.accountNumber)
    || input.accountName.trim().length < 2 || input.accountName.trim().length > 160
    || input.narration.trim().length < 3 || input.narration.trim().length > 120) {
    throw new TypeError('Invalid bank payout details');
  }
  return { provider: input.provider, bankCode:input.bankCode,
    accountNumber:input.accountNumber, accountName:input.accountName.trim(),
    amountMinor, currency:'NGN' as const, narration:input.narration.trim() };
}

export type BankListEntry = {bankCode:string;name:string};
export async function listTransferBanks(provider: PayoutProvider): Promise<BankListEntry[]> {
  if (!validProvider(provider)) throw new TypeError('Unknown bank provider');
  const response=await api.get('/transfers/banks',{params:{provider}});
  const body=response.data as {provider?:unknown;banks?:unknown};
  if (body.provider !== provider || !Array.isArray(body.banks) || body.banks.length>1200) {
    throw new TypeError('Invalid provider bank directory');
  }
  const seen=new Set<string>();
  return body.banks.map((value:unknown)=>{
    if(!value || typeof value !== 'object')throw new TypeError('Invalid bank entry');
    const r=value as Record<string,unknown>;
    if(typeof r.bankCode!=='string'|| !/^[A-Za-z0-9_-]{2,20}$/.test(r.bankCode) ||
      typeof r.name!=='string'|| r.name.trim().length<2||r.name.length>100 || seen.has(r.bankCode)) throw new TypeError('Invalid or duplicated bank code');
    seen.add(r.bankCode);return {bankCode:r.bankCode,name:r.name};
  });
}

export async function resolveBankAccount(provider: PayoutProvider, bankCode: string, accountNumber: string): Promise<VerifiedBankAccount> {
  if (!validProvider(provider) || !/^[A-Za-z0-9_-]{2,20}$/.test(bankCode) || !/^\d{10}$/.test(accountNumber)) {
    throw new TypeError('Select a provider and enter a valid bank code and 10-digit account number');
  }
  const response = await api.post('/transfers/resolve-account',{provider,bankCode,accountNumber,currency:'NGN'});
  const account = (response.data as {account?: VerifiedBankAccount}).account;
  if (!account || account.providerCode !== provider || account.bankCode !== bankCode
    || account.currency !== 'NGN' || !account.accountName || typeof account.accountName !== 'string'
    || account.accountNumber !== `******${accountNumber.slice(-4)}`
    || (account.bankName !== undefined && typeof account.bankName !== 'string')) {
    throw new TypeError('Provider returned an unexpected beneficiary; verification cannot continue');
  }
  return account;
}

export type BankTransferQuote = {
  quoteToken: string; quoteId: string; expiresAt: string;
  provider: PayoutProvider; bankCode: string; bankName?: string | null;
  accountNumberMasked: string; accountName: string;
  amountMinor: string; feeMinor: string; totalDebitMinor: string; currency: 'NGN';
};
export async function getBankTransferQuote(input: TransferIntent): Promise<BankTransferQuote> {
  if (import.meta.env.VITE_TWIPAY_TRANSFER_SANDBOX_ENABLED !== 'true') throw new Error('Bank transfers are currently unavailable');
  const d = details(input);
  const response = await api.post('/transfers/quote',{ provider:d.provider,bankCode:d.bankCode,accountNumber:d.accountNumber,
    narration:d.narration,amountMinor:d.amountMinor,currency:'NGN' });
  const q = response.data as BankTransferQuote;
  if (!q || q.provider !== d.provider || q.bankCode !== d.bankCode || q.amountMinor !== d.amountMinor
    || q.accountName !== d.accountName || q.accountNumberMasked !== `******${d.accountNumber.slice(-4)}`
    || q.currency !== 'NGN' || !/^[a-f0-9-]{36}$/.test(q.quoteId)
    || typeof q.quoteToken !== 'string' || q.quoteToken.length < 80
    || typeof q.feeMinor !== 'string' || !/^(0|[1-9]\d*)$/.test(q.feeMinor)
    || q.totalDebitMinor !== (BigInt(q.amountMinor) + BigInt(q.feeMinor)).toString()
    || !Number.isFinite(Date.parse(q.expiresAt)) || Date.parse(q.expiresAt) <= Date.now()) {
    throw new Error('Bank transfer quote could not be verified');
  }
  return q;
}
export type SavedBeneficiary = {
  id: string; bankCode: string; accountName: string; accountNumberMasked: string;
  nickname: string | null; currency: string; updatedAt?: string;
};
export async function listSavedBeneficiaries(): Promise<SavedBeneficiary[]> {
  const response = await api.get('/transfers/beneficiaries');
  const records = (response.data as {beneficiaries?: unknown}).beneficiaries;
  if (!Array.isArray(records) || records.length > 100) throw new Error('Invalid saved beneficiaries response');
  return records.map((record:unknown) => {
    const b = record as SavedBeneficiary;
    if (!b || !/^[0-9a-f-]{36}$/.test(b.id) || !/^\*{6}\d{4}$/.test(b.accountNumberMasked)
      || typeof b.accountName !== 'string' || typeof b.bankCode !== 'string' || b.currency !== 'NGN') {
      throw new Error('Invalid saved beneficiary');
    }
    return b;
  });
}
export async function saveTransferBeneficiary(input: {provider:PayoutProvider;bankCode:string;accountNumber:string;nickname?:string}) {
  if (import.meta.env.VITE_TWIPAY_TRANSFER_SANDBOX_ENABLED !== 'true') throw new Error('Saving recipients is unavailable');
  await api.post('/transfers/beneficiaries',input);
}
export async function renameSavedBeneficiary(id:string,nickname:string|null){
  if (!/^[0-9a-f-]{36}$/.test(id) || (nickname!==null&&(nickname.trim().length<1||nickname.trim().length>60))) throw new Error('Invalid saved-recipient update');
  await api.patch(`/transfers/beneficiaries/${id}`,{nickname:nickname?.trim()??null});
}
export async function removeSavedBeneficiary(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('Invalid recipient');
  await api.delete(`/transfers/beneficiaries/${id}`);
}

type SavedPayout = { digest: string; key: string; createdAt: number; reference?: string };
function existingAttempt(): SavedPayout | null {
  try {
    const data=JSON.parse(sessionStorage.getItem(INTENT_STORAGE_KEY) ?? 'null') as SavedPayout | null;
    if (data && /^[a-f0-9]{64}$/.test(data.digest) && UUID_PATTERN.test(data.key) &&
      Number.isSafeInteger(data.createdAt) && data.createdAt <= Date.now() &&
      Date.now()-data.createdAt < 23*60*60*1000 &&
      (data.reference === undefined || /^[A-Za-z0-9._:-]{1,80}$/.test(data.reference))) return data;
  } catch { /* Fail closed if storage is unavailable */ }
  return null;
}

/** Avoid putting beneficiary account data in sessionStorage; only SHA-256 of the instruction is retained. */
export async function transferAttempt(input: TransferIntent): Promise<string> {
  const instruction = details(input);
  if (!crypto.subtle) throw new Error('Secure browser cryptography is unavailable');
  const digestBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(instruction)));
  const digest = [...new Uint8Array(digestBuffer)].map(x=>x.toString(16).padStart(2,'0')).join('');
  const saved = existingAttempt();
  if (saved) {
    if (saved.digest !== digest) throw new Error('A different transfer attempt is in progress. Review its status before deliberately starting a new attempt.');
    return saved.key;
  }
  const key = `twipay-payout:${crypto.randomUUID()}`;
  try { sessionStorage.setItem(INTENT_STORAGE_KEY,JSON.stringify({digest,key,createdAt:Date.now()})); }
  catch { throw new Error('Cannot protect transfer retries because session storage is unavailable'); }
  return key;
}
export function hasTransferAttempt(): boolean { return existingAttempt() !== null; }
/** This is only allowed after the customer reviews the existing transaction's status. */
export function abandonTransferAttempt(): void { sessionStorage.removeItem(INTENT_STORAGE_KEY); }

export function validateTransferResponse(value: unknown, instruction: TransferIntent): BankPayoutResponse {
  if (!value || typeof value !== 'object') throw new TypeError('Unexpected bank payout response');
  const r = value as Record<string,unknown>;
  const expected = details(instruction);
  if (typeof r.transactionReference !== 'string' || !/^[A-Za-z0-9._:-]{1,80}$/.test(r.transactionReference)
    || r.provider !== expected.provider || !statuses.has(String(r.status))
    || (r.amountMinor !== undefined && r.amountMinor !== expected.amountMinor)
    || (r.currency !== undefined && r.currency !== 'NGN')) throw new TypeError('Untrusted transfer response: check transaction history');
  if (r.beneficiary !== undefined) {
    const beneficiary = r.beneficiary as Record<string,unknown>;
    if (!beneficiary || beneficiary.bankCode !== expected.bankCode ||
        beneficiary.accountNumber !== `******${expected.accountNumber.slice(-4)}` ||
        beneficiary.accountName !== expected.accountName) throw new TypeError('Transfer beneficiary mismatch: check history');
  }
  return r as BankPayoutResponse;
}
export async function initiateBankTransfer(input: TransferIntent, transactionPin: string, quote: BankTransferQuote): Promise<BankPayoutResponse> {
  if (import.meta.env.VITE_TWIPAY_TRANSFER_SANDBOX_ENABLED !== 'true') {
    throw new Error('Bank transfers are not yet release-qualified');
  }
  const d=details(input);
  if (!/^\d{4}$/.test(transactionPin)) throw new Error('Enter your four-digit transaction PIN');
  if (quote.amountMinor !== d.amountMinor || quote.provider !== d.provider || quote.bankCode !== d.bankCode ||
      quote.accountName !== d.accountName || quote.accountNumberMasked !== `******${d.accountNumber.slice(-4)}` ||
      Date.parse(quote.expiresAt) <= Date.now()) throw new Error('Transfer details changed. Request a new quote.');
  const key=await transferAttempt(input);
  const response=await api.post('/transfers',{
    provider:d.provider, amountMinor:d.amountMinor,currency:'NGN',bankCode:d.bankCode,
    accountNumber:d.accountNumber,expectedAccountName:d.accountName,narration:d.narration,
    quoteToken:quote.quoteToken,transactionPin,
  },{headers:{'Idempotency-Key':key}});
  const result=validateTransferResponse(response.data,input);
  if (result.feeMinor !== quote.feeMinor || result.totalDebitMinor !== quote.totalDebitMinor) throw new Error('Untrusted fee or debit total: check transaction history');
  const attempt=existingAttempt();
  if(attempt && attempt.key===key){
    try {sessionStorage.setItem(INTENT_STORAGE_KEY,JSON.stringify({...attempt,reference:result.transactionReference}));} catch {/* keep current retry key */}
  }
  return result;
}
