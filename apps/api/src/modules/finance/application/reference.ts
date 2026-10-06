import { randomUUID } from 'node:crypto';

export function createFinancialReference(prefix: 'fund' | 'xfer' | 'va' | 'kyc' | 'jrn' | 'bill' | 'evt' | 'ntf'): string {
  return `twp_${prefix}_${randomUUID()}`;
}
