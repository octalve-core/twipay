import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FinanceModule } from '../finance/finance.module.js';
import { ProvidersModule } from '../providers/providers.module.js';
import { KycService } from './application/kyc.service.js';
import { KycController } from './presentation/kyc.controller.js';

@Module({ imports: [AuthModule, FinanceModule, ProvidersModule], controllers: [KycController], providers: [KycService], exports: [KycService] })
export class KycModule {}
