/** Phase 4.2: server-authored, short-lived bank payout terms. Never accept a client fee. */
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';

export type TransferQuoteTerms = {
  id: string; userId: string; provider: 'paystack' | 'monnify'; bankCode: string;
  accountFingerprint: string; savedBeneficiaryId?: string; nameDigest: string; narrationDigest: string;
  amountMinor: string; feeMinor: string; totalDebitMinor: string; expiresAt: number;
};
const MAX_AMOUNT = BigInt(Number.MAX_SAFE_INTEGER);
function blocked(): never { throw new ServiceUnavailableException({ code: 'TRANSFER_FEE_POLICY_NOT_APPROVED' }); }
function hash(value: string): string { return createHash('sha256').update(value.trim().toLowerCase()).digest('hex'); }
function secret(): Buffer {
  const raw = process.env['TRANSFER_QUOTE_HMAC_KEY'];
  if (!raw || !/^[a-f0-9]{64,}$/i.test(raw) || raw.length % 2 !== 0 || /^([0-9a-f])\1+$/i.test(raw) ||
    [process.env['PII_FINGERPRINT_KEY'],process.env['SESSION_HASH_PEPPER'],process.env['TRANSACTION_PIN_PEPPER'],process.env['DATA_ENCRYPTION_KEY']].some(value => !!value && value === raw)) blocked();
  return Buffer.from(raw, 'hex');
}
export function approvedFee(provider: 'paystack' | 'monnify'): bigint {
  if (process.env['NODE_ENV'] === 'production' || process.env['TRANSFER_FEE_SANDBOX_APPROVED'] !== 'true') blocked();
  const raw = process.env[provider === 'paystack' ? 'TRANSFER_FEE_PAYSTACK_MINOR' : 'TRANSFER_FEE_MONNIFY_MINOR'];
  if (raw === undefined || !/^(0|[1-9]\d{0,15})$/.test(raw)) blocked();
  const fee = BigInt(raw);
  if (fee > MAX_AMOUNT) blocked();
  return fee;
}
export function issueTransferQuote(input: {
  userId: string; provider: 'paystack' | 'monnify'; bankCode: string;
  accountFingerprint: string; accountName: string; narration: string; amountMinor: bigint; savedBeneficiaryId?: string;
}): { token: string; terms: TransferQuoteTerms } {
  const fee = approvedFee(input.provider);
  const total = input.amountMinor + fee;
  if (input.amountMinor <= 0n || total > MAX_AMOUNT || input.accountName.trim().length < 2) blocked();
  const terms: TransferQuoteTerms = {
    id: randomUUID(), userId: input.userId, provider: input.provider, bankCode: input.bankCode,
    accountFingerprint: input.accountFingerprint, ...(input.savedBeneficiaryId ? { savedBeneficiaryId: input.savedBeneficiaryId } : {}),
    nameDigest: hash(input.accountName), narrationDigest: hash(input.narration),
    amountMinor: input.amountMinor.toString(), feeMinor: fee.toString(), totalDebitMinor: total.toString(),
    expiresAt: Date.now() + 5 * 60_000,
  };
  const payload = Buffer.from(JSON.stringify(terms)).toString('base64url');
  const signature = createHmac('sha256', secret()).update(payload).digest('base64url');
  return { token: `${payload}.${signature}`, terms };
}
export function verifyTransferQuote(input: {
  token: string; userId: string; provider: 'paystack' | 'monnify'; bankCode: string;
  accountFingerprint: string; accountName: string; narration: string; amountMinor: bigint; savedBeneficiaryId?: string;
}): TransferQuoteTerms {
  if (typeof input.token !== 'string' || input.token.length > 3000 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(input.token)) {
    throw new ForbiddenException({ code: 'TRANSFER_QUOTE_INVALID' });
  }
  const [payload, signature] = input.token.split('.');
  const expected = createHmac('sha256', secret()).update(payload!).digest();
  const given = Buffer.from(signature!, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(expected, given)) throw new ForbiddenException({ code: 'TRANSFER_QUOTE_INVALID' });
  let quote: TransferQuoteTerms;
  try { quote = JSON.parse(Buffer.from(payload!, 'base64url').toString('utf8')) as TransferQuoteTerms; }
  catch { throw new ForbiddenException({ code: 'TRANSFER_QUOTE_INVALID' }); }
  if (!quote || !/^[0-9a-f-]{36}$/.test(quote.id) || quote.userId !== input.userId || quote.provider !== input.provider || quote.bankCode !== input.bankCode
    || quote.accountFingerprint !== input.accountFingerprint || quote.savedBeneficiaryId !== input.savedBeneficiaryId || quote.nameDigest !== hash(input.accountName) || quote.narrationDigest !== hash(input.narration)
    || quote.amountMinor !== input.amountMinor.toString() || !Number.isSafeInteger(quote.expiresAt) || quote.expiresAt <= Date.now() || quote.expiresAt > Date.now() + 5 * 60_000) {
    throw new ForbiddenException({ code: 'TRANSFER_QUOTE_EXPIRED_OR_CHANGED' });
  }
  const fee = approvedFee(input.provider);
  if (quote.feeMinor !== fee.toString() || quote.totalDebitMinor !== (input.amountMinor + fee).toString()) {
    throw new ForbiddenException({ code: 'TRANSFER_FEE_CHANGED_REQUEST_NEW_QUOTE' });
  }
  return quote;
}
