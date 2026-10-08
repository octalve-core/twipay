import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SessionAuthGuard, requirePrincipal, type AuthenticatedFastifyRequest } from '../../auth/presentation/session-auth.guard.js';
import { NotificationService } from '../application/notification.service.js';

@ApiTags('customer-notifications')
@Controller('notifications')
@UseGuards(SessionAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationService) {}
  /** Delivery records only. No fabricated read/unread state or decrypted message bodies. */
  @Get()
  async history(@Req() req: AuthenticatedFastifyRequest) {
    const principal = requirePrincipal(req);
    return { notifications: await this.notifications.listDeliveryHistory(principal.userId) };
  }
}
