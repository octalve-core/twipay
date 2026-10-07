import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../platform/database/prisma.service.js';

export interface AuditInput {
  actorUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string;
  requestId?: string;
  beforeState?: Prisma.InputJsonValue;
  afterState?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditInput) {
    return this.prisma.operationalAuditEvent.create({ data: input });
  }

  async recordWithTx(tx: Prisma.TransactionClient, input: AuditInput) {
    return tx.operationalAuditEvent.create({ data: input });
  }

  async list(limit = 100) {
    return this.prisma.operationalAuditEvent.findMany({ orderBy: { occurredAt: 'desc' }, take: Math.min(Math.max(limit, 1), 250) });
  }
}
