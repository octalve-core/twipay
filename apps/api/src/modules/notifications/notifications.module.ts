import { Module } from '@nestjs/common';
import { ProvidersModule } from '../providers/providers.module.js';
import { NotificationService } from './application/notification.service.js';

@Module({ imports: [ProvidersModule], providers: [NotificationService], exports: [NotificationService] })
export class NotificationsModule {}
