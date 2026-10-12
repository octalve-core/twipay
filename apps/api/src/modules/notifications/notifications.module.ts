import { Module } from '@nestjs/common';
import { ProvidersModule } from '../providers/providers.module.js';
import { NotificationService } from './application/notification.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsController } from './presentation/notifications.controller.js';
import { NotificationOperationsController } from './presentation/notification-operations.controller.js';

@Module({ imports: [ProvidersModule, AuthModule], controllers: [NotificationsController, NotificationOperationsController], providers: [NotificationService], exports: [NotificationService] })
export class NotificationsModule {}
