import { Injectable } from '@nestjs/common';
import type { JsonObject } from '@twipay/contracts';
import { PrismaService } from '../../../platform/database/prisma.service.js';

@Injectable()
export class ReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  async openCase(input: {
    type: 'PROVIDER_STATUS_MISMATCH' | 'AMOUNT_MISMATCH' | 'MISSING_INTERNAL' | 'MISSING_PROVIDER' | 'DUPLICATE_EVENT' | 'LEDGER_MISMATCH';
    summary: string;
    financialTransactionId?: string;
    providerOperationId?: string;
    evidence?: JsonObject;
    needsReview?: boolean;
  }) {
    return this.prisma.reconciliationCase.create({
      data: {
        type: input.type,
        status: input.needsReview === false ? 'OPEN' : 'NEEDS_REVIEW',
        summary: input.summary,
        ...(input.financialTransactionId ? { financialTransactionId: input.financialTransactionId } : {}),
        ...(input.providerOperationId ? { providerOperationId: input.providerOperationId } : {}),
        ...(input.evidence ? { evidence: input.evidence } : {}),
      },
    });
  }
}
