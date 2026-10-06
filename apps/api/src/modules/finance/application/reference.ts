import { randomUUID } from 'node:crypto';

export function createFinancialReference(prefix: 'fund' | 'xfer' | 'va' | 'kyc' | 'jrn'): string {
  return `twp_${prefix}_${randomUUID()}`;
}
