/** TwiPay Virtual Account API — owner-scoped read and sandbox-gated provisioning.
 * Never call the legacy BillPadi static-account endpoints.
 * No BVN/NIN or validation account number may be saved in browser storage.
 */
import api from '../axios';

export type VirtualAccountProvider = 'paystack' | 'monnify';
export type VirtualAccount = {
  provider: VirtualAccountProvider;
  reference: string;
  status: 'ACTIVE' | 'PENDING' | 'INACTIVE' | 'FAILED';
  accountNumber: string;
  accountName: string;
  bankName: string;
  bankCode?: string;
  currency: 'NGN';
};
export type Provisioning = {
  reference: string;
  provider: VirtualAccountProvider;
  status: 'PENDING' | 'PROCESSING' | 'REQUIRES_ACTION' | 'UNKNOWN' | 'FAILED' | 'SUCCEEDED' | 'REVERSED';
  createdAt: string;
};
export type VirtualAccountsList = {virtualAccounts: VirtualAccount[]; provisioning: Provisioning[]};
export type VirtualAccountResult = {
  provider: VirtualAccountProvider;
  reference: string;
  status: 'ACTIVE' | 'PENDING' | 'INACTIVE' | 'UNKNOWN' | 'FAILED';
  accountNumber?: string;
  accountName?: string;
  bankName?: string;
  bankCode?: string;
  code?: string;
};
export type ValidationBank = {bankCode: string; name: string};
export type CreateVirtualAccountInput = {
  provider: VirtualAccountProvider;
  consent: true;
  preferredBank?: string;
  validationBankCode?: string;
  validationAccountNumber?: string;
};

const STORAGE_KEY = 'twipay:virtual-account-provisioning-intent:v1';
const allowedProviders = new Set(['paystack','monnify']);
const allowedAccountStates = new Set(['ACTIVE','PENDING','INACTIVE','FAILED']);
const allowedOperationStates = new Set(['PENDING','PROCESSING','REQUIRES_ACTION','UNKNOWN','FAILED','SUCCEEDED','REVERSED']);
const allowedResultStates = new Set(['ACTIVE','PENDING','INACTIVE','UNKNOWN','FAILED']);
const referencePattern = /^[A-Za-z0-9._:-]{1,120}$/;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid virtual account response');
  return value as Record<string, unknown>;
}
function providerValid(value: unknown): value is VirtualAccountProvider {
  return typeof value === 'string' && allowedProviders.has(value);
}
function safeReference(value: unknown): value is string {
  return typeof value === 'string' && referencePattern.test(value);
}

export function parseVirtualAccounts(value: unknown): VirtualAccountsList {
  const root = object(value);
  if (!Array.isArray(root.virtualAccounts) || !Array.isArray(root.provisioning)) throw new TypeError('Invalid account listing');
  const virtualAccounts: VirtualAccount[] = root.virtualAccounts.map(item => {
    const a = object(item);
    if (!providerValid(a.provider) || !safeReference(a.reference) || !allowedAccountStates.has(String(a.status)) ||
        typeof a.accountNumber !== 'string' || !/^\d{10,20}$/.test(a.accountNumber) ||
        typeof a.accountName !== 'string' || !a.accountName.trim() ||
        typeof a.bankName !== 'string' || !a.bankName.trim() || a.currency !== 'NGN') {
      throw new TypeError('Invalid assigned account record');
    }
    return a as VirtualAccount;
  });
  const provisioning: Provisioning[] = root.provisioning.map(item => {
    const op = object(item);
    if (!providerValid(op.provider) || !safeReference(op.reference) || !allowedOperationStates.has(String(op.status)) ||
        typeof op.createdAt !== 'string' || !Number.isFinite(Date.parse(op.createdAt))) {
      throw new TypeError('Invalid provisioning status');
    }
    return op as Provisioning;
  });
  return {virtualAccounts, provisioning};
}

export async function listVirtualAccounts(): Promise<VirtualAccountsList> {
  const response = await api.get('/virtual-accounts');
  return parseVirtualAccounts(response.data);
}

export function parseValidationBanks(value: unknown): ValidationBank[] {
  const result = object(value);
  if (result.provider !== 'paystack' || !Array.isArray(result.banks) || result.banks.length > 2000) {
    throw new TypeError('Invalid validation bank directory');
  }
  const banks = result.banks.map(item => {
    const b = object(item);
    if (typeof b.name !== 'string' || b.name.length < 2 || b.name.length > 160 ||
        typeof b.bankCode !== 'string' || !/^[A-Za-z0-9-]{2,20}$/.test(b.bankCode)) {
      throw new TypeError('Invalid bank directory entry');
    }
    return {name:b.name, bankCode:b.bankCode};
  });
  return banks;
}

export async function listVirtualAccountValidationBanks(): Promise<ValidationBank[]> {
  const response = await api.get('/virtual-accounts/validation-banks');
  return parseValidationBanks(response.data);
}

type StoredIntent = {provider:VirtualAccountProvider;key:string;createdAt:number};
function readIntent(): StoredIntent | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null') as StoredIntent | null;
    if (v && providerValid(v.provider) && /^twipay-va:[0-9a-f-]{36}$/.test(v.key) &&
        Number.isSafeInteger(v.createdAt) && Date.now() >= v.createdAt && Date.now() - v.createdAt < 23*60*60*1000) return v;
  } catch { /* never recover from malformed stored request state */ }
  return null;
}
export function hasVirtualAccountIntent(): boolean { return readIntent() !== null; }
export function abandonVirtualAccountIntent(): void { sessionStorage.removeItem(STORAGE_KEY); }
export function virtualAccountIdempotencyKey(provider: VirtualAccountProvider): string {
  if (!providerValid(provider)) throw new TypeError('Unsupported account provider');
  const pending = readIntent();
  if (pending) {
    if (pending.provider !== provider) throw new Error('Review your existing provisioning attempt before switching providers.');
    return pending.key;
  }
  const key = `twipay-va:${crypto.randomUUID()}`;
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({provider,key,createdAt:Date.now()})); }
  catch { throw new Error('Safe retry storage unavailable; account provisioning cannot start.'); }
  return key;
}
export function validateVirtualAccountInput(value: CreateVirtualAccountInput): void {
  if (!providerValid(value.provider) || value.consent !== true ||
      (value.preferredBank !== undefined && (value.preferredBank.length < 2 || value.preferredBank.length > 80))) {
    throw new TypeError('Invalid virtual-account request');
  }
  if (value.provider === 'paystack') {
    if (!value.validationBankCode || !/^[A-Za-z0-9-]{2,20}$/.test(value.validationBankCode) ||
        !value.validationAccountNumber || !/^\d{10}$/.test(value.validationAccountNumber)) {
      throw new TypeError('A valid 10-digit personal bank account and bank selection are required');
    }
  } else if (value.validationAccountNumber || value.validationBankCode) {
    throw new TypeError('Monnify request must not include Paystack validation details');
  }
}
export function parseVirtualAccountResult(value: unknown, provider:VirtualAccountProvider): VirtualAccountResult {
  const r = object(value);
  if (r.provider !== provider || !safeReference(r.reference) || !allowedResultStates.has(String(r.status))) {
    throw new TypeError('Untrusted virtual-account response; check provisioning history');
  }
  if (r.status === 'ACTIVE' && (!/^\d{10,20}$/.test(String(r.accountNumber)) ||
      typeof r.accountName !== 'string' || !r.accountName.trim() ||
      typeof r.bankName !== 'string' || !r.bankName.trim())) {
    throw new TypeError('Active account omitted required assignment evidence');
  }
  return r as VirtualAccountResult;
}
export async function provisionVirtualAccount(input:CreateVirtualAccountInput): Promise<VirtualAccountResult> {
  if (import.meta.env.VITE_TWIPAY_VIRTUAL_ACCOUNT_SANDBOX_ENABLED !== 'true') {
    throw new Error('Virtual account provisioning is not release-qualified');
  }
  validateVirtualAccountInput(input);
  const key=virtualAccountIdempotencyKey(input.provider);
  const response=await api.post('/virtual-accounts',input,{headers:{'Idempotency-Key':key}});
  return parseVirtualAccountResult(response.data,input.provider);
}
