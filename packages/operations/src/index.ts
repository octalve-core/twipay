export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'RESOLVED' | 'CANCELLED';
export type RefundStatus = 'REQUESTED' | 'UNDER_REVIEW' | 'APPROVED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'UNKNOWN' | 'REJECTED';
export type OrganizerPayoutStatus = 'REQUESTED' | 'PENDING_APPROVAL' | 'APPROVED' | 'PROVIDER_SUBMITTED' | 'PROCESSING' | 'UNKNOWN' | 'SUCCEEDED' | 'FAILED' | 'REJECTED' | 'REVERSED';

export class OperationsInvariantError extends Error {
  override readonly name = 'OperationsInvariantError';
}

const disputeTransitions: Readonly<Record<DisputeStatus, readonly DisputeStatus[]>> = {
  OPEN: ['UNDER_REVIEW', 'CANCELLED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED', 'RESOLVED'],
  APPROVED: ['RESOLVED'],
  REJECTED: ['RESOLVED'],
  RESOLVED: [],
  CANCELLED: [],
};

const refundTransitions: Readonly<Record<RefundStatus, readonly RefundStatus[]>> = {
  REQUESTED: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['PROCESSING'],
  PROCESSING: ['SUCCEEDED', 'FAILED', 'UNKNOWN'],
  UNKNOWN: ['PROCESSING', 'SUCCEEDED', 'FAILED'],
  SUCCEEDED: [],
  FAILED: [],
  REJECTED: [],
};

const payoutTransitions: Readonly<Record<OrganizerPayoutStatus, readonly OrganizerPayoutStatus[]>> = {
  REQUESTED: ['PENDING_APPROVAL', 'REJECTED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED'],
  APPROVED: ['PROVIDER_SUBMITTED'],
  PROVIDER_SUBMITTED: ['PROCESSING', 'UNKNOWN', 'SUCCEEDED', 'FAILED', 'REVERSED'],
  PROCESSING: ['UNKNOWN', 'SUCCEEDED', 'FAILED', 'REVERSED'],
  UNKNOWN: ['PROCESSING', 'SUCCEEDED', 'FAILED', 'REVERSED'],
  SUCCEEDED: ['REVERSED'],
  FAILED: [],
  REJECTED: [],
  REVERSED: [],
};

export function assertDisputeTransition(from: DisputeStatus, to: DisputeStatus): void {
  if (!disputeTransitions[from].includes(to)) throw new OperationsInvariantError(`invalid dispute transition ${from} -> ${to}`);
}

export function assertRefundTransition(from: RefundStatus, to: RefundStatus): void {
  if (!refundTransitions[from].includes(to)) throw new OperationsInvariantError(`invalid refund transition ${from} -> ${to}`);
}

export function assertOrganizerPayoutTransition(from: OrganizerPayoutStatus, to: OrganizerPayoutStatus): void {
  if (!payoutTransitions[from].includes(to)) throw new OperationsInvariantError(`invalid organizer payout transition ${from} -> ${to}`);
}

export function assertMakerChecker(makerUserId: string, checkerUserId: string): void {
  if (!makerUserId || !checkerUserId) throw new OperationsInvariantError('maker and checker are required');
  if (makerUserId === checkerUserId) throw new OperationsInvariantError('maker and checker must be different users');
}

export function calculateAvailableSettlement(postedBalanceMinor: bigint, reservedPayoutMinor: bigint): bigint {
  if (postedBalanceMinor < 0n) throw new OperationsInvariantError('organizer settlement balance cannot be negative');
  if (reservedPayoutMinor < 0n) throw new OperationsInvariantError('reserved payout cannot be negative');
  const available = postedBalanceMinor - reservedPayoutMinor;
  return available > 0n ? available : 0n;
}

export function assertPayoutAmount(availableMinor: bigint, requestedMinor: bigint): void {
  if (requestedMinor <= 0n) throw new OperationsInvariantError('payout amount must be positive');
  if (requestedMinor > availableMinor) throw new OperationsInvariantError('insufficient organizer settlement balance');
}

export function assertFullRefund(originalAmountMinor: bigint, requestedAmountMinor: bigint): void {
  if (originalAmountMinor <= 0n || requestedAmountMinor <= 0n) throw new OperationsInvariantError('refund amount must be positive');
  if (originalAmountMinor !== requestedAmountMinor) throw new OperationsInvariantError('Batch 4 event refunds must be full refunds');
}

export function assertFeatureKey(key: string): void {
  if (!/^[a-z][a-z0-9_.-]{2,119}$/.test(key)) throw new OperationsInvariantError('invalid feature flag key');
}

export function assertHexColor(value: string): void {
  if (!/^#[0-9A-Fa-f]{6}$/.test(value)) throw new OperationsInvariantError('invalid brand color');
}
