/** Batch D: strict, provider-neutral wire contracts. No legacy BillPadi shape assumptions. */
export const billCategories = ['AIRTIME', 'DATA', 'ELECTRICITY', 'CABLE'] as const;
export type BillCategory = typeof billCategories[number];
export type BillProduct = {
  code: string; category: BillCategory; name: string; customerIdentifierType: string;
  currency: 'NGN'; fixedAmountMinor: string | null; minAmountMinor: string | null; maxAmountMinor: string | null;
};
export type BillValidation = { id: string; valid: boolean; customerName: string | null; providerCode: string; expiresAt: string };
export type BillQuote = {
  quoteToken: string; quoteId: string; productCode: string; provider: string;
  expiresAt: string; currency: 'NGN'; amountMinor: string; feeMinor: string; totalDebitMinor: string;
};
export function readBillQuote(value: unknown, expected: { productCode: string; amountMinor: string }): BillQuote {
  const q = asRecord(asRecord(value).quote);
  if (typeof q.quoteToken !== 'string' || q.quoteToken.length < 100 || q.quoteToken.length > 3000
    || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(q.quoteToken)
    || typeof q.quoteId !== 'string' || !/^[0-9a-f-]{36}$/i.test(q.quoteId)
    || q.productCode !== expected.productCode || q.amountMinor !== expected.amountMinor
    || q.currency !== 'NGN' || typeof q.provider !== 'string' || !['vtpass','monnify'].includes(q.provider)
    || typeof q.expiresAt !== 'string' || !Number.isFinite(Date.parse(q.expiresAt))
    || Date.parse(q.expiresAt) <= Date.now() || Date.parse(q.expiresAt) > Date.now() + 5 * 60_000
    || typeof q.feeMinor !== 'string' || !minor.test(q.feeMinor)
    || typeof q.totalDebitMinor !== 'string' || !minor.test(q.totalDebitMinor)
    || BigInt(q.amountMinor as string) + BigInt(q.feeMinor) !== BigInt(q.totalDebitMinor)) {
    throw new TypeError('The utility price confirmation is unavailable or changed. Verify again.');
  }
  return q as unknown as BillQuote;
}
export type BillPurchase = {
  reference: string; status: string; productCode: string; category: BillCategory;
  productName: string; amountMinor: string; currency: 'NGN'; provider: string; fulfillment?: string;
};
const minor = /^(?:0|[1-9]\d{0,17})$/;
const ref = /^[A-Za-z0-9._:-]{1,80}$/;
const productCode = /^[A-Za-z0-9._:-]{3,120}$/;
const asRecord = (x: unknown): Record<string, unknown> => {
  if (!x || typeof x !== 'object' || Array.isArray(x)) throw new TypeError('Unexpected TwiPay bills API response');
  return x as Record<string, unknown>;
};
function nullableAmount(x: unknown): string | null {
  if (x === null) return null;
  if (typeof x !== 'string' || !minor.test(x)) throw new TypeError('Invalid product price response');
  return x;
}
export function readBillCatalogue(value: unknown, category: BillCategory): BillProduct[] {
  const r = asRecord(value);
  if (!Array.isArray(r.products) || r.products.length > 10000) throw new TypeError('Invalid bill catalogue');
  const ids = new Set<string>();
  return r.products.map((item: unknown) => {
    const p = asRecord(item);
    if (p.category !== category || typeof p.code !== 'string' || !productCode.test(p.code)
        || ids.has(p.code) || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 200
        || typeof p.customerIdentifierType !== 'string' || p.customerIdentifierType.length > 80
        || p.currency !== 'NGN') throw new TypeError('Unexpected bill product');
    ids.add(p.code);
    const product: BillProduct = {
      code: p.code, category, name: p.name, customerIdentifierType: p.customerIdentifierType,
      currency: 'NGN', fixedAmountMinor: nullableAmount(p.fixedAmountMinor),
      minAmountMinor: nullableAmount(p.minAmountMinor), maxAmountMinor: nullableAmount(p.maxAmountMinor),
    };
    if (product.fixedAmountMinor !== null && BigInt(product.fixedAmountMinor) === 0n) throw new TypeError('Invalid fixed price');
    if (product.minAmountMinor && product.maxAmountMinor && BigInt(product.minAmountMinor) > BigInt(product.maxAmountMinor)) throw new TypeError('Invalid price bounds');
    return product;
  });
}
/** Only decimal-string naira amounts; never floating point for financial amounts. */
export function billNairaToMinor(naira: string, product: BillProduct): string {
  if (!/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(naira)) throw new TypeError('Enter a valid amount with up to two decimal places');
  const [whole, frac = ''] = naira.split('.');
  const amt = BigInt(whole) * 100n + BigInt(frac.padEnd(2, '0'));
  if (amt <= 0n || amt > BigInt(Number.MAX_SAFE_INTEGER)) throw new TypeError('Amount is outside the supported range');
  if (product.fixedAmountMinor !== null && amt !== BigInt(product.fixedAmountMinor)) throw new TypeError('This product has a fixed price');
  if (product.minAmountMinor !== null && amt < BigInt(product.minAmountMinor)) throw new TypeError('Amount is below the provider minimum');
  if (product.maxAmountMinor !== null && amt > BigInt(product.maxAmountMinor)) throw new TypeError('Amount exceeds the provider maximum');
  return amt.toString();
}
export function readBillValidation(value: unknown): BillValidation {
  const r = asRecord(asRecord(value).validation);
  if (typeof r.id !== 'string' || !/^[0-9a-fA-F-]{36}$/.test(r.id) || typeof r.valid !== 'boolean'
      || (r.customerName !== null && typeof r.customerName !== 'string')
      || typeof r.providerCode !== 'string' || typeof r.expiresAt !== 'string'
      || !Number.isFinite(Date.parse(r.expiresAt))) throw new TypeError('Invalid bill validation result');
  return r as unknown as BillValidation;
}
export function readBillPurchase(value: unknown, expected?: { productCode: string; amountMinor: string }): BillPurchase {
  const r = asRecord(value);
  const statuses = ['CREATED','VALIDATING','VALIDATED','FUNDS_RESERVED','PROVIDER_SUBMITTED','PROCESSING','REQUIRES_ACTION','PENDING','SUCCEEDED','FAILED','CANCELLED','REVERSED','UNKNOWN'];
  if (typeof r.reference !== 'string' || !ref.test(r.reference) || typeof r.status !== 'string' || !statuses.includes(r.status)
      || typeof r.productCode !== 'string' || !productCode.test(r.productCode)
      || !billCategories.includes(r.category as BillCategory) || typeof r.productName !== 'string'
      || typeof r.amountMinor !== 'string' || !minor.test(r.amountMinor) || r.currency !== 'NGN'
      || typeof r.provider !== 'string' || (r.fulfillment !== undefined && typeof r.fulfillment !== 'string')) {
    throw new TypeError('Unexpected bill purchase response; check purchase history before retrying');
  }
  if (expected && (r.productCode !== expected.productCode || r.amountMinor !== expected.amountMinor)) {
    throw new TypeError('Purchase response does not match the submitted payment');
  }
  return r as unknown as BillPurchase;
}
export function billIdentifier(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 3 || trimmed.length > 64 || /[\u0000-\u001f\u007f]/.test(trimmed)) throw new TypeError('Enter a valid customer identifier (3–64 characters)');
  return trimmed;
}
export function billIsFinal(status: string): boolean { return ['SUCCEEDED','FAILED','REVERSED','CANCELLED'].includes(status); }
export function billIsSuccess(status: string): boolean { return status === 'SUCCEEDED'; }
export function billsSandboxEnabled(flag: string | undefined, nodeEnv?: string): boolean { return flag === 'true' && nodeEnv !== 'production'; }

/** Provider submission can be uncertain: the server may return only reference/status/code (202). */
export type BillSubmission = BillPurchase | {reference:string; status:'UNKNOWN'; code:string};
export function readBillSubmission(value:unknown, expected:{productCode:string;amountMinor:string}):BillSubmission {
  const r=asRecord(value);
  if (r.status==='UNKNOWN' && typeof r.reference==='string' && ref.test(r.reference)
      && typeof r.code==='string' && /^[_A-Z]{3,100}$/.test(r.code)
      && r.productCode===undefined && r.amountMinor===undefined) {
    return {reference:r.reference,status:'UNKNOWN',code:r.code};
  }
  return readBillPurchase(value,expected);
}

export function readBillPurchases(value:unknown):BillPurchase[] {
  const r=asRecord(value);
  if (!Array.isArray(r.purchases) || r.purchases.length > 100) throw new TypeError('Unexpected bill purchases response');
  return r.purchases.map((item:unknown)=>readBillPurchase(item));
}
