import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FinanceModule } from '../finance/finance.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { ProductModule } from '../product/product.module.js';
import { EventService } from './application/event.service.js';
import { EventsController } from './presentation/events.controller.js';

@Module({
  imports: [AuthModule, FinanceModule, NotificationsModule, ProductModule],
  controllers: [EventsController],
  providers: [EventService],
  exports: [EventService],
})
export class EventsModule {}
