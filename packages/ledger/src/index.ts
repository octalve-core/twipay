export type CurrencyCode = 'NGN' | 'USD' | 'GBP' | 'EUR';
export type LedgerSide = 'DEBIT' | 'CREDIT';
export type NormalBalance = LedgerSide;

export interface LedgerEntryDraft {
  accountId: string;
  side: LedgerSide;
  amountMinor: bigint;
  currency: CurrencyCode;
  memo?: string;
}

export type FinancialTransactionStatus =
  | 'CREATED'
  | 'AUTHORIZED'
  | 'FUNDS_RESERVED'
  | 'PROVIDER_SUBMITTED'
  | 'PROCESSING'
  | 'UNKNOWN'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REVERSED'
  | 'CANCELLED';

export type WalletHoldStatus = 'ACTIVE' | 'CAPTURED' | 'RELEASED' | 'EXPIRED';

export class LedgerInvariantError extends Error {
  override readonly name = 'LedgerInvariantError';
}

export class InvalidStateTransitionError extends Error {
  override readonly name = 'InvalidStateTransitionError';
}

export function assertMinorAmount(amountMinor: bigint): void {
  if (amountMinor <= 0n) throw new LedgerInvariantError('amountMinor must be greater than zero');
}

export function assertCurrencyCode(currency: string): asserts currency is CurrencyCode {
  if (!/^[A-Z]{3}$/.test(currency)) throw new LedgerInvariantError('currency must be a three-letter uppercase code');
}

export function assertBalanced(entries: readonly LedgerEntryDraft[]): void {
  if (entries.length < 2) throw new LedgerInvariantError('a journal transaction requires at least two entries');
  const currencies = new Set(entries.map((entry) => entry.currency));
  if (currencies.size !== 1) throw new LedgerInvariantError('cross-currency journal transactions are prohibited');

  let debit = 0n;
  let credit = 0n;
  for (const entry of entries) {
    assertMinorAmount(entry.amountMinor);
    if (entry.side === 'DEBIT') debit += entry.amountMinor;
    else credit += entry.amountMinor;
  }
  if (debit !== credit) throw new LedgerInvariantError(`unbalanced journal: debit=${debit} credit=${credit}`);
}

export function accountBalanceDelta(normalBalance: NormalBalance, entry: Pick<LedgerEntryDraft, 'side' | 'amountMinor'>): bigint {
  assertMinorAmount(entry.amountMinor);
  return entry.side === normalBalance ? entry.amountMinor : -entry.amountMinor;
}

const financialTransitions: Readonly<Record<FinancialTransactionStatus, readonly FinancialTransactionStatus[]>> = {
  CREATED: ['AUTHORIZED', 'FAILED', 'CANCELLED'],
  AUTHORIZED: ['FUNDS_RESERVED', 'PROVIDER_SUBMITTED', 'FAILED', 'CANCELLED'],
  FUNDS_RESERVED: ['PROVIDER_SUBMITTED', 'FAILED', 'CANCELLED'],
  PROVIDER_SUBMITTED: ['PROCESSING', 'UNKNOWN', 'SUCCEEDED', 'FAILED', 'REVERSED'],
  PROCESSING: ['UNKNOWN', 'SUCCEEDED', 'FAILED', 'REVERSED'],
  UNKNOWN: ['PROCESSING', 'SUCCEEDED', 'FAILED', 'REVERSED'],
  SUCCEEDED: ['REVERSED'],
  FAILED: [],
  REVERSED: [],
  CANCELLED: [],
};

export function assertFinancialTransition(from: FinancialTransactionStatus, to: FinancialTransactionStatus): void {
  if (!financialTransitions[from].includes(to)) {
    throw new InvalidStateTransitionError(`invalid financial transaction transition ${from} -> ${to}`);
  }
}

const holdTransitions: Readonly<Record<WalletHoldStatus, readonly WalletHoldStatus[]>> = {
  ACTIVE: ['CAPTURED', 'RELEASED', 'EXPIRED'],
  CAPTURED: [],
  RELEASED: [],
  EXPIRED: [],
};

export function assertHoldTransition(from: WalletHoldStatus, to: WalletHoldStatus): void {
  if (!holdTransitions[from].includes(to)) {
    throw new InvalidStateTransitionError(`invalid wallet hold transition ${from} -> ${to}`);
  }
}

export function calculateAvailableBalance(postedBalanceMinor: bigint, activeHoldsMinor: bigint): bigint {
  if (activeHoldsMinor < 0n) throw new LedgerInvariantError('active holds cannot be negative');
  return postedBalanceMinor - activeHoldsMinor;
}

export function assertSufficientAvailableBalance(availableMinor: bigint, requestedMinor: bigint): void {
  assertMinorAmount(requestedMinor);
  if (availableMinor < requestedMinor) throw new LedgerInvariantError('insufficient available balance');
}

export function validateIdempotencyKey(key: string): string {
  const normalized = key.trim();
  if (normalized.length < 16 || normalized.length > 128) {
    throw new LedgerInvariantError('idempotency key must be 16-128 characters');
  }
  if (!/^[A-Za-z0-9._:-]+$/.test(normalized)) {
    throw new LedgerInvariantError('idempotency key contains unsupported characters');
  }
  return normalized;
}
