import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FinanceModule } from '../finance/finance.module.js';
import { ProvidersModule } from '../providers/providers.module.js';
import { BillCatalogService } from './application/catalog.service.js';
import { BillProviderRouterService } from './application/provider-router.service.js';
import { BillService } from './application/bill.service.js';
import { ServicesController } from './presentation/services.controller.js';

@Module({
  imports: [AuthModule, FinanceModule, ProvidersModule],
  controllers: [ServicesController],
  providers: [BillCatalogService, BillProviderRouterService, BillService],
  exports: [BillCatalogService, BillProviderRouterService, BillService],
})
export class ServicesModule {}
