import type { NotificationProviderPort, SendNotificationInput, NotificationDeliveryResult } from '@twipay/contracts';

export interface TermiiConfig { apiKey: string; senderId: string; baseUrl?: string; channel?: string; requestTimeoutMs?: number; }
type UnknownRecord = Record<string, unknown>;
function record(value: unknown): UnknownRecord { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('TERMII_INVALID_RESPONSE'); return value as UnknownRecord; }
function text(value: unknown): string | undefined { return typeof value === 'string' ? value : undefined; }

export class TermiiAdapter implements NotificationProviderPort {
  readonly code = 'termii';
  readonly channels = ['SMS'] as const;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  constructor(private readonly config: TermiiConfig) {
    if (!config.apiKey || !config.senderId) throw new Error('TERMII_CONFIGURATION_REQUIRED');
    this.baseUrl = (config.baseUrl ?? 'https://api.ng.termii.com').replace(/\/$/, '');
    this.timeoutMs = config.requestTimeoutMs ?? 10_000;
  }
  async send(input: SendNotificationInput): Promise<NotificationDeliveryResult> {
    if (input.channel !== 'SMS') throw new Error('TERMII_SMS_ONLY');
    const response = await fetch(`${this.baseUrl}/api/sms/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        to: input.destination.replace(/^\+/, ''),
        from: input.sender ?? this.config.senderId,
        sms: input.text,
        type: 'plain',
        channel: this.config.channel ?? 'generic',
        api_key: this.config.apiKey,
      }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const body = record(await response.json());
    if (!response.ok) return { providerCode: this.code, status: 'FAILED', rawStatus: `HTTP_${response.status}` };
    const providerReference = text(body['message_id']);
    return { providerCode: this.code, ...(providerReference ? { providerReference } : {}), status: providerReference ? 'ACCEPTED' : 'UNKNOWN', rawStatus: text(body['message']) ?? 'accepted' };
  }
}
