import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FinanceModule } from '../finance/finance.module.js';
import { ProductModule } from '../product/product.module.js';
import { ProvidersModule } from '../providers/providers.module.js';
import { AuditService } from './application/audit.service.js';
import { DisputeRefundService } from './application/dispute-refund.service.js';
import { ComplianceService } from './application/compliance.service.js';
import { OrganizerPayoutService } from './application/organizer-payout.service.js';
import { ProviderOperationsService } from './application/provider-operations.service.js';
import { ReportsService } from './application/reports.service.js';
import { CustomerOperationsController } from './presentation/customer-operations.controller.js';
import { OperationsController } from './presentation/operations.controller.js';

@Module({
  imports:[AuthModule,FinanceModule,ProvidersModule,ProductModule],
  controllers:[CustomerOperationsController,OperationsController],
  providers:[AuditService,ComplianceService,DisputeRefundService,OrganizerPayoutService,ProviderOperationsService,ReportsService],
  exports:[AuditService,ComplianceService,DisputeRefundService,OrganizerPayoutService,ProviderOperationsService,ReportsService],
})
export class OperationsModule {}
