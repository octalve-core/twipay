import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PermissionGuard, RequirePermissions, requireMfa } from '../../auth/presentation/permission.guard.js';
import { SessionAuthGuard, type AuthenticatedFastifyRequest } from '../../auth/presentation/session-auth.guard.js';
import { NotificationService } from '../application/notification.service.js';

/** Aggregates only: never returns destinations, customer IDs, subjects, bodies or inbox contents. */
@ApiTags('operations-notification-health')
@Controller('operations/notifications')
@UseGuards(SessionAuthGuard, PermissionGuard)
export class NotificationOperationsController {
  constructor(private readonly notifications:NotificationService) {}
  @Get('delivery-summary')
  @RequirePermissions('ops.notifications.read')
  async summary(@Req() req:AuthenticatedFastifyRequest) {
    requireMfa(req);
    return this.notifications.deliverySummary();
  }
}
