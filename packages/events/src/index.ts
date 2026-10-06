import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'SALES_PAUSED' | 'SOLD_OUT' | 'CANCELLED' | 'COMPLETED';
export type EventOrderStatus = 'CREATED' | 'FUNDS_RESERVED' | 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED';
export type TicketStatus = 'ACTIVE' | 'CHECKED_IN' | 'CANCELLED' | 'REFUNDED' | 'VOID';

export class EventInvariantError extends Error {
  override readonly name = 'EventInvariantError';
}

const eventTransitions: Readonly<Record<EventStatus, readonly EventStatus[]>> = {
  DRAFT: ['PUBLISHED', 'CANCELLED'],
  PUBLISHED: ['SALES_PAUSED', 'SOLD_OUT', 'CANCELLED', 'COMPLETED'],
  SALES_PAUSED: ['PUBLISHED', 'CANCELLED', 'COMPLETED'],
  SOLD_OUT: ['SALES_PAUSED', 'CANCELLED', 'COMPLETED'],
  CANCELLED: [],
  COMPLETED: [],
};

const orderTransitions: Readonly<Record<EventOrderStatus, readonly EventOrderStatus[]>> = {
  CREATED: ['FUNDS_RESERVED', 'FAILED', 'CANCELLED'],
  FUNDS_RESERVED: ['PAID', 'FAILED', 'CANCELLED'],
  PAID: [],
  FAILED: [],
  CANCELLED: [],
  REFUNDED: [],
};

const ticketTransitions: Readonly<Record<TicketStatus, readonly TicketStatus[]>> = {
  ACTIVE: ['CHECKED_IN', 'CANCELLED', 'VOID'],
  CHECKED_IN: [],
  CANCELLED: [],
  REFUNDED: [],
  VOID: [],
};

export function assertEventTransition(from: EventStatus, to: EventStatus): void {
  if (!eventTransitions[from].includes(to)) throw new EventInvariantError(`invalid event transition ${from} -> ${to}`);
}
export function assertEventOrderTransition(from: EventOrderStatus, to: EventOrderStatus): void {
  if (!orderTransitions[from].includes(to)) throw new EventInvariantError(`invalid event order transition ${from} -> ${to}`);
}
export function assertTicketTransition(from: TicketStatus, to: TicketStatus): void {
  if (!ticketTransitions[from].includes(to)) throw new EventInvariantError(`invalid ticket transition ${from} -> ${to}`);
}

export function assertCapacityAvailable(capacity: number, alreadyReservedOrSold: number, requested: number): void {
  if (!Number.isInteger(capacity) || capacity < 1) throw new EventInvariantError('ticket capacity must be a positive integer');
  if (!Number.isInteger(requested) || requested < 1) throw new EventInvariantError('ticket quantity must be a positive integer');
  if (alreadyReservedOrSold < 0 || alreadyReservedOrSold + requested > capacity) throw new EventInvariantError('ticket capacity exceeded');
}

export function calculateSettlement(input: { grossMinor: bigint; platformFeeMinor: bigint }): { organizerMinor: bigint; platformFeeMinor: bigint } {
  if (input.grossMinor <= 0n) throw new EventInvariantError('event gross amount must be positive');
  if (input.platformFeeMinor < 0n || input.platformFeeMinor > input.grossMinor) throw new EventInvariantError('invalid platform fee');
  return { organizerMinor: input.grossMinor - input.platformFeeMinor, platformFeeMinor: input.platformFeeMinor };
}


export function calculatePlatformFeeMinor(grossMinor: bigint, feeBps: number): bigint {
  if (grossMinor <= 0n) throw new EventInvariantError('event gross amount must be positive');
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 5_000) throw new EventInvariantError('invalid platform fee basis points');
  return (grossMinor * BigInt(feeBps)) / 10_000n;
}

export function extractTicketPublicCode(payload: string): string {
  const match = /^twipay-ticket:v1:([A-Za-z0-9_-]{8,100}):([A-Za-z0-9_-]{40,80})$/.exec(payload);
  if (!match?.[1]) throw new EventInvariantError('invalid ticket credential');
  return match[1];
}

function hmac(value: string, key: string): Buffer {
  if (key.length < 32) throw new EventInvariantError('ticket signing key must contain at least 32 characters');
  return createHmac('sha256', key).update(value).digest();
}

export interface TicketCredential {
  publicCode: string;
  token: string;
  fingerprint: string;
  qrPayload: string;
}

export function createTicketCredential(publicCode: string, signingKey: string): TicketCredential {
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(publicCode)) throw new EventInvariantError('invalid ticket public code');
  const token = randomBytes(32).toString('base64url');
  const fingerprint = hmac(`${publicCode}.${token}`, signingKey).toString('hex');
  return { publicCode, token, fingerprint, qrPayload: `twipay-ticket:v1:${publicCode}:${token}` };
}

export function parseAndVerifyTicketCredential(payload: string, expectedFingerprint: string, signingKey: string): { publicCode: string } {
  const match = /^twipay-ticket:v1:([A-Za-z0-9_-]{8,100}):([A-Za-z0-9_-]{40,80})$/.exec(payload);
  if (!match?.[1] || !match[2]) throw new EventInvariantError('invalid ticket credential');
  if (!/^[a-f0-9]{64}$/i.test(expectedFingerprint)) throw new EventInvariantError('invalid ticket fingerprint');
  const calculated = hmac(`${match[1]}.${match[2]}`, signingKey);
  const expected = Buffer.from(expectedFingerprint, 'hex');
  if (expected.length !== calculated.length || !timingSafeEqual(calculated, expected)) throw new EventInvariantError('ticket credential mismatch');
  return { publicCode: match[1] };
}
