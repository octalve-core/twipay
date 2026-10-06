import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { NotificationChannel, NotificationProviderPort } from '@twipay/contracts';
import { TermiiAdapter } from '@twipay/provider-termii';
import { ResendAdapter } from '@twipay/provider-resend';

@Injectable()
export class NotificationProviderRegistry {
  private sms?: NotificationProviderPort;
  private email?: NotificationProviderPort;

  get(channel: NotificationChannel): NotificationProviderPort {
    if (channel === 'SMS') {
      if (this.sms) return this.sms;
      const apiKey = process.env['TERMII_API_KEY'];
      const senderId = process.env['TERMII_SENDER_ID'];
      if (!apiKey || !senderId) throw new ServiceUnavailableException({ code: 'TERMII_NOT_CONFIGURED' });
      this.sms = new TermiiAdapter({
        apiKey,
        senderId,
        ...(process.env['TERMII_BASE_URL'] ? { baseUrl: process.env['TERMII_BASE_URL'] } : {}),
        ...(process.env['TERMII_CHANNEL'] ? { channel: process.env['TERMII_CHANNEL'] } : {}),
      });
      return this.sms;
    }

    if (this.email) return this.email;
    const apiKey = process.env['RESEND_API_KEY'];
    const defaultFrom = process.env['RESEND_FROM'];
    if (!apiKey || !defaultFrom) throw new ServiceUnavailableException({ code: 'RESEND_NOT_CONFIGURED' });
    this.email = new ResendAdapter({
      apiKey,
      defaultFrom,
      ...(process.env['RESEND_BASE_URL'] ? { baseUrl: process.env['RESEND_BASE_URL'] } : {}),
    });
    return this.email;
  }
}
