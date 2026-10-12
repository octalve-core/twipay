/** Batch 4.5: signed, short-lived, server-authored utility purchase terms.
 * Customer fees MUST be independently approved. Non-zero fees require separate
 * ledger accounting and are intentionally unsupported in this release gate. */
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';

export type BillQuoteTerms = {
  id: string; userId: string; productCode: string; productId: string; offerId: string;
  identifierDigest: string; validationId: string; pricingDigest: string;
  amountMinor: string; feeMinor: string; totalDebitMinor: string; expiresAt: number;
};
const invalid = (): never => { throw new ForbiddenException({ code: 'BILL_QUOTE_INVALID_EXPIRED_OR_CHANGED' }); };
const unavailable: () => never = () => { throw new ServiceUnavailableException({ code: 'BILL_PRICING_POLICY_NOT_APPROVED' }); };
const sha = (v: string): string => createHash('sha256').update(v).digest('hex');
function secret(): Buffer {
  const raw = process.env['BILL_QUOTE_HMAC_KEY'];
  if (!raw || !/^(?:[0-9a-f]{2}){32,}$/i.test(raw) || /^([0-9a-f])\1+$/i.test(raw)
    || ['PII_FINGERPRINT_KEY','SESSION_HASH_PEPPER','TRANSACTION_PIN_PEPPER','DATA_ENCRYPTION_KEY','TRANSFER_QUOTE_HMAC_KEY']
      .some(key => process.env[key] && process.env[key] === raw)) unavailable();
  return Buffer.from(raw, 'hex');
}
function approvedFee(): bigint {
  if (process.env['NODE_ENV'] === 'production' || process.env['BILL_FEE_POLICY_SANDBOX_APPROVED'] !== 'true') unavailable();
  // Do not silently introduce a payable fee without new balanced fee journals.
  if (process.env['BILL_CUSTOMER_FEE_MINOR'] !== '0') unavailable();
  return 0n;
}
export function billPricingDigest(input: { fixedAmountMinor: bigint | null; minAmountMinor: bigint | null; maxAmountMinor: bigint | null; currency: string; status: string; category: string; name: string; customerIdentifierType: string }): string {
  return sha(JSON.stringify([input.fixedAmountMinor?.toString() ?? null, input.minAmountMinor?.toString() ?? null,
    input.maxAmountMinor?.toString() ?? null, input.currency, input.status, input.category, input.name, input.customerIdentifierType]));
}
export function issueBillQuote(input: {
  userId: string; productCode: string; productId: string; offerId: string;
  identifierFingerprint: string; validationId: string; pricingDigest: string; amountMinor: bigint;
}): { token: string; terms: BillQuoteTerms } {
  const fee = approvedFee();
  if (input.amountMinor <= 0n || input.amountMinor + fee > BigInt(Number.MAX_SAFE_INTEGER)) unavailable();
  const terms: BillQuoteTerms = {
    id: randomUUID(), userId: input.userId, productCode: input.productCode, productId: input.productId,
    offerId: input.offerId, identifierDigest: input.identifierFingerprint, validationId: input.validationId,
    pricingDigest: input.pricingDigest, amountMinor: input.amountMinor.toString(), feeMinor: fee.toString(),
    totalDebitMinor: (input.amountMinor + fee).toString(), expiresAt: Date.now() + 5 * 60_000,
  };
  const body = Buffer.from(JSON.stringify(terms)).toString('base64url');
  return { token: `${body}.${createHmac('sha256', secret()).update(body).digest('base64url')}`, terms };
}
export function verifyBillQuote(input: {
  token: string; userId: string; productCode: string; productId: string; offerId: string;
  identifierFingerprint: string; validationId: string; pricingDigest: string; amountMinor: bigint;
}): BillQuoteTerms {
  if (typeof input.token !== 'string' || input.token.length > 3000 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(input.token)) invalid();
  const [body, signature] = input.token.split('.');
  const expected = createHmac('sha256', secret()).update(body!).digest();
  const actual = Buffer.from(signature!, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(expected, actual)) invalid();
  let q: BillQuoteTerms;
  try { q = JSON.parse(Buffer.from(body!, 'base64url').toString('utf8')) as BillQuoteTerms; }
  catch { return invalid(); }
  const now = Date.now();
  if (!q || !/^[0-9a-f-]{36}$/.test(q.id) || q.userId !== input.userId || q.productCode !== input.productCode
    || q.productId !== input.productId || q.offerId !== input.offerId || q.identifierDigest !== input.identifierFingerprint
    || q.validationId !== input.validationId || q.pricingDigest !== input.pricingDigest
    || q.amountMinor !== input.amountMinor.toString() || !Number.isSafeInteger(q.expiresAt)
    || q.expiresAt <= now || q.expiresAt > now + 5 * 60_000) invalid();
  const fee = approvedFee();
  if (q.feeMinor !== fee.toString() || q.totalDebitMinor !== (input.amountMinor + fee).toString()) invalid();
  return q;
}
