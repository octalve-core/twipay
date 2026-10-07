import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../platform/database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ProvidersModule } from './providers/providers.module.js';
import { FinanceModule } from './finance/finance.module.js';
import { WebhooksModule } from './webhooks/webhooks.module.js';
import { KycModule } from './kyc/kyc.module.js';
import { ServicesModule } from './services/services.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { EventsModule } from './events/events.module.js';
import { ProductModule } from './product/product.module.js';
import { OperationsModule } from './operations/operations.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: process.env['NODE_ENV'] === 'production' }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    ProvidersModule,
    FinanceModule,
    WebhooksModule,
    KycModule,
    ServicesModule,
    NotificationsModule,
    EventsModule,
    ProductModule,
    OperationsModule,
  ],
})
export class AppModule {}
