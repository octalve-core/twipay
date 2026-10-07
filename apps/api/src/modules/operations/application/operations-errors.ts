import { ConflictException, HttpException } from '@nestjs/common';
import type { JsonObject } from '@twipay/contracts';
import { OperationsInvariantError } from '@twipay/operations';

const invariantCodes: Readonly<Record<string,string>> = {
  'maker and checker must be different users': 'MAKER_CHECKER_SEPARATION_REQUIRED',
  'maker and checker are required': 'MAKER_CHECKER_SEPARATION_REQUIRED',
  'insufficient organizer settlement balance': 'INSUFFICIENT_ORGANIZER_SETTLEMENT',
  'payout amount must be positive': 'INVALID_PAYOUT_AMOUNT',
  'organizer settlement balance cannot be negative': 'ORGANIZER_SETTLEMENT_INVALID',
  'reserved payout cannot be negative': 'ORGANIZER_SETTLEMENT_INVALID',
  'Batch 4 event refunds must be full refunds': 'REFUND_AMOUNT_MISMATCH',
  'refund amount must be positive': 'REFUND_AMOUNT_INVALID',
};

export function toOperationsHttpError(error: unknown, fallbackCode: string): unknown {
  if (error instanceof HttpException) return error;
  if (error instanceof OperationsInvariantError) {
    const code = invariantCodes[error.message] ?? (error.message.startsWith('invalid ') ? 'INVALID_OPERATION_STATE' : fallbackCode);
    return new ConflictException({ code });
  }
  return error;
}

export function deterministicFailure(error: unknown, fallbackCode: string): { status: number; body: JsonObject } | null {
  if (!(error instanceof HttpException)) return null;
  const status = error.getStatus();
  if (status >= 500) return null;
  const response = error.getResponse();
  let code = fallbackCode;
  if (response && typeof response === 'object' && !Array.isArray(response) && 'code' in response) {
    const candidate = (response as { code?: unknown }).code;
    if (typeof candidate === 'string' && /^[A-Z0-9_]{3,120}$/.test(candidate)) code = candidate;
  }
  return { status, body: { code } };
}
