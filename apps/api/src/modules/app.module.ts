import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../platform/database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ProvidersModule } from './providers/providers.module.js';
import { FinanceModule } from './finance/finance.module.js';
import { WebhooksModule } from './webhooks/webhooks.module.js';
import { KycModule } from './kyc/kyc.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: process.env.NODE_ENV === 'production' }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    ProvidersModule,
    FinanceModule,
    WebhooksModule,
    KycModule,
  ],
})
export class AppModule {}
