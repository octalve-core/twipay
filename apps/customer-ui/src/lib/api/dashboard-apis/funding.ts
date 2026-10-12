/** TwiPay checkout collections (Batch C2): independent of the legacy bank-transfer-account contract. */
import api from '../axios';

export type FundingProvider = 'paystack' | 'monnify';
export type FundingStatus = 'PENDING' | 'PROCESSING' | 'UNKNOWN' | 'SUCCEEDED' | 'FAILED' | 'REVERSED';
export type FundingInitiation = {
  transactionReference: string;
  provider: FundingProvider;
  status: FundingStatus;
  amountMinor?: string;
  currency?: 'NGN';
  checkoutUrl?: string;
  code?: string;
};

const MAX_PROVIDER_MINOR = 9007199254740991n;
const INTENT_KEY = 'twipay:funding-intent:v1';
const REFERENCE_KEY = 'twipay:last-funding-reference:v1';
const FUNDING_REFERENCE = /^[A-Za-z0-9._:-]{1,80}$/;
const fundingStatuses = new Set<FundingStatus>(['PENDING','PROCESSING','UNKNOWN','SUCCEEDED','FAILED','REVERSED']);
const pendingBackendStates = new Set(['CREATED','AUTHORIZED','FUNDS_RESERVED']);
const processingBackendStates = new Set(['PROVIDER_SUBMITTED']);
const providers: FundingProvider[] = ['paystack', 'monnify'];

/** Do not use parseFloat/Number for naira->kobo conversions. */
export function nairaToMinor(naira: string): string {
  if (!/^(?:0|[1-9]\d{0,13})(?:\.\d{1,2})?$/.test(naira)) throw new TypeError('Enter a valid naira amount (maximum two decimals)');
  const [whole, fraction = ''] = naira.split('.');
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (minor <= 0n || minor > MAX_PROVIDER_MINOR) throw new TypeError('Amount is outside the supported funding range');
  return minor.toString();
}

export function safeCheckoutUrl(value: string | undefined, provider: FundingProvider): string | null {
  if (typeof value !== 'string') return null;
  try {
    const parsed = new URL(value);
    // Only the selected payment provider can receive a checkout redirect.
    const root = provider === 'paystack' ? 'paystack.com' : 'monnify.com';
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port ||
        !(parsed.hostname === root || parsed.hostname.endsWith(`.${root}`))) return null;
    return parsed.toString();
  } catch { return null; }
}

type StoredAttempt = {provider:FundingProvider;amountMinor:string;idempotencyKey:string;createdAt:number};
function readAttempt(): StoredAttempt | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(INTENT_KEY) ?? 'null') as StoredAttempt | null;
    if (value && providers.includes(value.provider) && /^\d{1,16}$/.test(value.amountMinor) &&
        /^twipay-fund:[0-9a-f-]{36}$/.test(value.idempotencyKey) &&
        Number.isSafeInteger(value.createdAt) && Date.now() - value.createdAt < 23 * 60 * 60 * 1000) return value;
  } catch { /* corrupted or unavailable storage is not a funding authorization */ }
  return null;
}

/** Same intent/key across retries and page refreshes; new intent only via explicit user action. */
export function fundingAttempt(provider: FundingProvider, amountMinor: string): string {
  if (!providers.includes(provider) || !/^[1-9]\d*$/.test(amountMinor) || BigInt(amountMinor) > MAX_PROVIDER_MINOR) {
    throw new TypeError('Invalid funding request');
  }
  const previous = readAttempt();
  if (previous) {
    if (previous.provider !== provider || previous.amountMinor !== amountMinor) {
      throw new Error('A different funding attempt exists. Review your history before starting a new payment.');
    }
    return previous.idempotencyKey;
  }
  const idempotencyKey = `twipay-fund:${crypto.randomUUID()}`;
  try { sessionStorage.setItem(INTENT_KEY, JSON.stringify({provider,amountMinor,idempotencyKey,createdAt:Date.now()})); }
  catch { throw new Error('Secure funding retry storage is unavailable. Enable session storage to continue.'); }
  return idempotencyKey;
}

export function hasOpenFundingAttempt(): boolean { return readAttempt() !== null; }
/** Explicitly start a new payment only after checking the status of the previous reference. */
export function abandonFundingAttempt(): void { sessionStorage.removeItem(INTENT_KEY); sessionStorage.removeItem(REFERENCE_KEY); }
/** Only an API-issued reference is used for status refresh, never provider redirect parameters. */
export function lastFundingReference(): string | null {
  try {
    const record = JSON.parse(sessionStorage.getItem(REFERENCE_KEY) ?? 'null') as {reference?:string;createdAt?:number}|null;
    if (record && FUNDING_REFERENCE.test(record.reference ?? '') && Number.isSafeInteger(record.createdAt) &&
        Date.now() >= record.createdAt! && Date.now() - record.createdAt! < 23*60*60*1000) return record.reference!;
  } catch { /* never trust corrupted client hints */ }
  return null;
}
export type FundingStatusDetail = {reference:string;status:FundingStatus;amountMinor:string;updatedAt:string};
export async function getFundingStatus(reference:string): Promise<FundingStatusDetail> {
  if (!FUNDING_REFERENCE.test(reference)) throw new TypeError('Invalid payment reference');
  const result = await api.get<{transaction:null|Record<string,unknown>}>(`/transactions/${encodeURIComponent(reference)}`);
  const record=result.data.transaction;
  if (!record || record.type !== 'FUNDING' || record.reference !== reference || record.currency !== 'NGN' ||
      !(fundingStatuses.has(record.status as FundingStatus) || pendingBackendStates.has(String(record.status)) || processingBackendStates.has(String(record.status))) ||
      typeof record.amountMinor !== 'string' || !/^[1-9]\d*$/.test(record.amountMinor) ||
      typeof record.updatedAt !== 'string' || !Number.isFinite(Date.parse(record.updatedAt))) {
    throw new TypeError('Payment status is not available. Review transaction history.');
  }
  const status = pendingBackendStates.has(String(record.status)) ? 'PENDING' : processingBackendStates.has(String(record.status)) ? 'PROCESSING' : record.status as FundingStatus;
  return {reference,status:status as FundingStatus,amountMinor:record.amountMinor,updatedAt:record.updatedAt};
}


export function validateFundingInitiation(value: unknown, provider: FundingProvider, amountMinor: string): FundingInitiation {
  if (!value || typeof value !== 'object') throw new TypeError('Unexpected funding response');
  const r = value as Record<string, unknown>;
  if (typeof r.transactionReference !== 'string' || !/^[A-Za-z0-9._:-]{1,80}$/.test(r.transactionReference)
      || r.provider !== provider || !['PENDING','PROCESSING','UNKNOWN','SUCCEEDED','FAILED','REVERSED'].includes(String(r.status))
      || (r.amountMinor !== undefined && r.amountMinor !== amountMinor)
      || (r.currency !== undefined && r.currency !== 'NGN')
      || (r.checkoutUrl !== undefined && typeof r.checkoutUrl !== 'string')) {
    throw new TypeError('Unexpected funding response; check transaction history before retrying');
  }
  return r as FundingInitiation;
}

/** Provider can return UNKNOWN/202. No frontend code may mark funding SUCCEEDED. */
export async function initiateFunding(provider: FundingProvider, amountNaira: string, transactionPin: string): Promise<FundingInitiation> {
  if (!/^\d{4}$/.test(transactionPin)) throw new TypeError('Enter your four-digit transaction PIN');
  const amountMinor = nairaToMinor(amountNaira);
  const idempotencyKey = fundingAttempt(provider, amountMinor);
  const response = await api.post('/payments/collections',
    {provider, amountMinor, currency:'NGN', transactionPin}, {headers:{'Idempotency-Key':idempotencyKey}});
  const result=validateFundingInitiation(response.data, provider, amountMinor);
  // A provider redirect is never an attestation of successful payment.
  try { sessionStorage.setItem(REFERENCE_KEY,JSON.stringify({reference:result.transactionReference,createdAt:Date.now()})); }
  catch { /* read-only status remains available through transaction history */ }
  return result;
}
