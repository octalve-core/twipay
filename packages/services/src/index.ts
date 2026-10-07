import type { BillCategory, CurrencyCode, NormalizedProviderStatus } from '@twipay/contracts';

export type BillPurchaseStatus =
  | 'CREATED'
  | 'VALIDATING'
  | 'VALIDATED'
  | 'FUNDS_RESERVED'
  | 'PROVIDER_SUBMITTED'
  | 'PROCESSING'
  | 'UNKNOWN'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REVERSED'
  | 'CANCELLED';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class ServiceInvariantError extends Error {
  override readonly name = 'ServiceInvariantError';
}

const transitions: Readonly<Record<BillPurchaseStatus, readonly BillPurchaseStatus[]>> = {
  CREATED: ['VALIDATING', 'VALIDATED', 'FAILED', 'CANCELLED'],
  VALIDATING: ['VALIDATED', 'FAILED', 'CANCELLED'],
  VALIDATED: ['FUNDS_RESERVED', 'FAILED', 'CANCELLED'],
  FUNDS_RESERVED: ['PROVIDER_SUBMITTED', 'FAILED', 'CANCELLED'],
  PROVIDER_SUBMITTED: ['PROCESSING', 'UNKNOWN', 'SUCCEEDED', 'FAILED', 'REVERSED'],
  PROCESSING: ['UNKNOWN', 'SUCCEEDED', 'FAILED', 'REVERSED'],
  UNKNOWN: ['PROCESSING', 'SUCCEEDED', 'FAILED', 'REVERSED'],
  SUCCEEDED: ['REVERSED'],
  FAILED: [],
  REVERSED: [],
  CANCELLED: [],
};

export function assertBillPurchaseTransition(from: BillPurchaseStatus, to: BillPurchaseStatus): void {
  if (!transitions[from].includes(to)) throw new ServiceInvariantError(`invalid bill purchase transition ${from} -> ${to}`);
}

export function assertBillAmount(input: {
  amountMinor: bigint;
  fixedAmountMinor?: bigint;
  minAmountMinor?: bigint;
  maxAmountMinor?: bigint;
}): void {
  if (input.amountMinor <= 0n) throw new ServiceInvariantError('bill amount must be greater than zero');
  if (input.fixedAmountMinor !== undefined && input.amountMinor !== input.fixedAmountMinor) {
    throw new ServiceInvariantError('bill amount does not match fixed product amount');
  }
  if (input.minAmountMinor !== undefined && input.amountMinor < input.minAmountMinor) {
    throw new ServiceInvariantError('bill amount is below product minimum');
  }
  if (input.maxAmountMinor !== undefined && input.amountMinor > input.maxAmountMinor) {
    throw new ServiceInvariantError('bill amount exceeds product maximum');
  }
}

export interface RouteCandidate {
  providerCode: string;
  providerOfferId: string;
  category: BillCategory;
  currency: CurrencyCode;
  active: boolean;
  priority: number;
  estimatedCostMinor?: bigint;
  successRateBps?: number;
  p95LatencyMs?: number;
  circuitState: CircuitState;
  cooldownUntil?: Date;
}

export interface RouteDecision {
  providerCode: string;
  providerOfferId: string;
  score: number;
}

export function isCircuitAvailable(candidate: RouteCandidate, now = new Date()): boolean {
  if (!candidate.active) return false;
  if (candidate.circuitState === 'CLOSED' || candidate.circuitState === 'HALF_OPEN') return true;
  return Boolean(candidate.cooldownUntil && candidate.cooldownUntil.getTime() <= now.getTime());
}

export function routeScore(candidate: RouteCandidate): number {
  if (!candidate.active || candidate.circuitState === 'OPEN') return Number.NEGATIVE_INFINITY;
  const success = candidate.successRateBps ?? 9_500;
  const latencyPenalty = Math.min(candidate.p95LatencyMs ?? 1_500, 30_000) / 100;
  const costPenalty = candidate.estimatedCostMinor === undefined
    ? 0
    : Number(candidate.estimatedCostMinor > 10_000_000n ? 10_000_000n : candidate.estimatedCostMinor) / 100_000;
  return candidate.priority * 10_000 + success - latencyPenalty - costPenalty;
}

export function chooseRoute(candidates: readonly RouteCandidate[], now = new Date()): RouteDecision | undefined {
  const eligible = candidates.filter((candidate) => isCircuitAvailable(candidate, now));
  let selected: RouteDecision | undefined;
  for (const candidate of eligible) {
    const score = routeScore({ ...candidate, circuitState: candidate.circuitState === 'OPEN' ? 'HALF_OPEN' : candidate.circuitState });
    if (!selected || score > selected.score || (score === selected.score && candidate.providerCode < selected.providerCode)) {
      selected = { providerCode: candidate.providerCode, providerOfferId: candidate.providerOfferId, score };
    }
  }
  return selected;
}

export interface CircuitSnapshot {
  state: CircuitState;
  consecutiveFailures: number;
  openedAt?: Date;
  cooldownUntil?: Date;
}

export function circuitAfterOutcome(
  current: CircuitSnapshot,
  outcome: 'SUCCESS' | 'DETERMINISTIC_FAILURE' | 'TRANSIENT_FAILURE',
  now = new Date(),
  threshold = 5,
  cooldownMs = 60_000,
): CircuitSnapshot {
  if (threshold < 1) throw new ServiceInvariantError('circuit threshold must be positive');
  if (outcome === 'SUCCESS') return { state: 'CLOSED', consecutiveFailures: 0 };
  if (outcome === 'DETERMINISTIC_FAILURE') {
    return current.state === 'HALF_OPEN' ? { state: 'CLOSED', consecutiveFailures: 0 } : current;
  }
  const failures = current.consecutiveFailures + 1;
  if (failures < threshold) return { ...current, consecutiveFailures: failures };
  return {
    state: 'OPEN',
    consecutiveFailures: failures,
    openedAt: now,
    cooldownUntil: new Date(now.getTime() + cooldownMs),
  };
}

export function normalizeProviderBillStatus(status: NormalizedProviderStatus): BillPurchaseStatus {
  switch (status) {
    case 'SUCCEEDED': return 'SUCCEEDED';
    case 'FAILED': return 'FAILED';
    case 'REVERSED': return 'REVERSED';
    case 'PROCESSING':
    case 'PENDING':
    case 'REQUIRES_ACTION': return 'PROCESSING';
    case 'UNKNOWN': return 'UNKNOWN';
    default:
      throw new ServiceInvariantError(`unsupported provider status: ${String(status)}`);
  }
}
