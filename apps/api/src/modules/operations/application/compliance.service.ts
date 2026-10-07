import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/database/prisma.service.js';

@Injectable()
export class ComplianceService {
  constructor(private readonly prisma: PrismaService) {}

  async snapshot() {
    const [verificationGroups, verifications, disputeGroups, disputes] = await Promise.all([
      this.prisma.identityVerification.groupBy({ by: ['type', 'status'], _count: { _all: true } }),
      this.prisma.identityVerification.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true,
          type: true,
          status: true,
          providerCode: true,
          identifierLast4: true,
          consentRecordedAt: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, email: true, givenName: true, familyName: true, status: true } },
        },
      }),
      this.prisma.dispute.groupBy({ by: ['status', 'category'], _count: { _all: true } }),
      this.prisma.dispute.findMany({
        orderBy: { openedAt: 'desc' },
        take: 100,
        select: {
          reference: true,
          status: true,
          category: true,
          reasonCode: true,
          openedAt: true,
          resolvedAt: true,
          user: { select: { id: true, email: true, status: true } },
          financialTransaction: { select: { reference: true, type: true, status: true, currency: true, amountMinor: true } },
        },
      }),
    ]);

    return {
      identity: {
        summary: verificationGroups.map((row) => ({ type: row.type, status: row.status, count: row._count._all })),
        verifications,
      },
      disputes: {
        summary: disputeGroups.map((row) => ({ category: row.category, status: row.status, count: row._count._all })),
        cases: disputes.map((row) => ({
          ...row,
          financialTransaction: { ...row.financialTransaction, amountMinor: row.financialTransaction.amountMinor.toString() },
        })),
      },
    };
  }
}
