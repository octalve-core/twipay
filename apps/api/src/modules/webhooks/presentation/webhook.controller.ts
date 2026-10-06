import { BadRequestException, Controller, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import type { RawWebhookRequest } from '@twipay/contracts';
import { WebhookService } from '../application/webhook.service.js';

type RawBodyRequest = FastifyRequest & { rawBody?: Buffer };

function toWebhookRequest(req: RawBodyRequest): RawWebhookRequest {
  if (!req.rawBody?.length) throw new BadRequestException({ code: 'RAW_WEBHOOK_BODY_REQUIRED' });
  return {
    rawBody: req.rawBody,
    headers: req.headers,
    sourceIp: req.ip,
  };
}

@ApiTags('provider-webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhooks: WebhookService) {}

  @Post('paystack')
  async paystack(@Req() req: RawBodyRequest) {
    return this.webhooks.receive('paystack', toWebhookRequest(req));
  }

  @Post('monnify')
  async monnify(@Req() req: RawBodyRequest) {
    return this.webhooks.receive('monnify', toWebhookRequest(req));
  }
}
