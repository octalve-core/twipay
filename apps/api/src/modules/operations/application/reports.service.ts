import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../platform/database/prisma.service.js';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [users, transactionGroups, paidEvents, billCommission, openDisputes, openReconciliation, pendingPayouts] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.financialTransaction.groupBy({ by: ['type', 'status'], where: { createdAt: { gte: since } }, _count: { _all: true }, _sum: { amountMinor: true, feeMinor: true } }),
      this.prisma.eventOrder.aggregate({ where: { status: 'PAID', paidAt: { gte: since } }, _count: { _all: true }, _sum: { totalMinor: true, platformFeeMinor: true } }),
      this.prisma.billPurchase.aggregate({ where: { status: 'SUCCEEDED', createdAt: { gte: since } }, _count: { _all: true }, _sum: { amountMinor: true, commissionMinor: true } }),
      this.prisma.dispute.count({ where: { status: { in: ['OPEN','UNDER_REVIEW','APPROVED'] } } }),
      this.prisma.reconciliationCase.count({ where: { status: { in: ['OPEN','NEEDS_REVIEW'] } } }),
      this.prisma.organizerPayout.count({ where: { status: { in: ['REQUESTED','PENDING_APPROVAL','APPROVED','PROVIDER_SUBMITTED','PROCESSING','UNKNOWN'] } } }),
    ]);
    return {
      period: { from: since, to: new Date() }, users,
      transactions: transactionGroups.map((row) => ({ type: row.type, status: row.status, count: row._count._all, amountMinor: (row._sum.amountMinor ?? 0n).toString(), feeMinor: (row._sum.feeMinor ?? 0n).toString() })),
      events: { paidOrders: paidEvents._count._all, grossMinor: (paidEvents._sum.totalMinor ?? 0n).toString(), platformFeeMinor: (paidEvents._sum.platformFeeMinor ?? 0n).toString() },
      bills: { successfulPurchases: billCommission._count._all, grossMinor: (billCommission._sum.amountMinor ?? 0n).toString(), observedProviderCommissionMinor: (billCommission._sum.commissionMinor ?? 0n).toString(), commissionRecognitionNote: 'Provider-reported commission is operational evidence; settlement accounting remains authoritative.' },
      queues: { openDisputes, openReconciliation, pendingOrganizerPayouts: pendingPayouts },
    };
  }
}
