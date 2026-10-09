import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { ZodValidationPipe } from '../../../platform/http/zod-validation.pipe.js';
import { SessionAuthGuard, requirePrincipal, type AuthenticatedFastifyRequest } from '../../auth/presentation/session-auth.guard.js';
import { NotificationService } from '../application/notification.service.js';

const PreferenceSchema = z.object({supportInApp:z.boolean(),eventInApp:z.boolean(),supportEmail:z.boolean()}).strict();
const IdSchema=z.uuid();
const CursorSchema=z.uuid().optional();

@ApiTags('customer-notifications')
@Controller('notifications')
@UseGuards(SessionAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationService) {}
  /** Backward-compatible delivery metadata view. No bodies or destinations. */
  @Get()
  async history(@Req() req: AuthenticatedFastifyRequest) {
    return { notifications: await this.notifications.listDeliveryHistory(requirePrincipal(req).userId) };
  }
  @Get('inbox')
  async inbox(@Req() req:AuthenticatedFastifyRequest,@Query('cursor',new ZodValidationPipe(CursorSchema)) cursor?:string) {
    return this.notifications.listInbox(requirePrincipal(req).userId,cursor);
  }
  @Post('inbox/read-all')
  async readAll(@Req() req:AuthenticatedFastifyRequest) {
    return this.notifications.markAllRead(requirePrincipal(req).userId);
  }
  @Post('inbox/:itemId/read')
  async readOne(@Param('itemId',new ZodValidationPipe(IdSchema)) itemId:string,@Req() req:AuthenticatedFastifyRequest) {
    return this.notifications.markRead(requirePrincipal(req).userId,itemId);
  }
  @Get('preferences')
  async getPreferences(@Req() req:AuthenticatedFastifyRequest) {
    return {preferences:await this.notifications.getPreferences(requirePrincipal(req).userId)};
  }
  @Put('preferences')
  async setPreferences(@Req() req:AuthenticatedFastifyRequest,@Body(new ZodValidationPipe(PreferenceSchema)) input:z.infer<typeof PreferenceSchema>) {
    return {preferences:await this.notifications.savePreferences(requirePrincipal(req).userId,input)};
  }
}
