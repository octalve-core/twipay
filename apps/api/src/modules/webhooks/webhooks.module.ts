import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module.js';
import { ProvidersModule } from '../providers/providers.module.js';
import { WebhookService } from './application/webhook.service.js';
import { WebhookController } from './presentation/webhook.controller.js';

@Module({ imports: [FinanceModule, ProvidersModule], controllers: [WebhookController], providers: [WebhookService] })
export class WebhooksModule {}
