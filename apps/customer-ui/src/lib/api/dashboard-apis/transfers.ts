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
export async function initiateBankTransfer(input: TransferIntent): Promise<BankPayoutResponse> {
  if (import.meta.env.VITE_TWIPAY_TRANSFER_SANDBOX_ENABLED !== 'true') {
    throw new Error('Bank transfers are not yet release-qualified');
  }
  const d=details(input);
  const key=await transferAttempt(input);
  const response=await api.post('/transfers',{
    provider:d.provider, amountMinor:d.amountMinor,currency:'NGN',bankCode:d.bankCode,
    accountNumber:d.accountNumber,expectedAccountName:d.accountName,narration:d.narration,
  },{headers:{'Idempotency-Key':key}});
  const result=validateTransferResponse(response.data,input);
  const attempt=existingAttempt();
  if(attempt && attempt.key===key){
    try {sessionStorage.setItem(INTENT_STORAGE_KEY,JSON.stringify({...attempt,reference:result.transactionReference}));} catch {/* keep current retry key */}
  }
  return result;
}
