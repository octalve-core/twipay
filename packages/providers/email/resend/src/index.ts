import type { NotificationProviderPort, SendNotificationInput, NotificationDeliveryResult } from '@twipay/contracts';
export interface ResendConfig { apiKey: string; defaultFrom: string; baseUrl?: string; requestTimeoutMs?: number; }
type UnknownRecord = Record<string, unknown>;
function record(value: unknown): UnknownRecord { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('RESEND_INVALID_RESPONSE'); return value as UnknownRecord; }
function text(value: unknown): string | undefined { return typeof value === 'string' ? value : undefined; }
export class ResendAdapter implements NotificationProviderPort {
  readonly code = 'resend';
  readonly channels = ['EMAIL'] as const;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  constructor(private readonly config: ResendConfig) {
    if (!config.apiKey || !config.defaultFrom) throw new Error('RESEND_CONFIGURATION_REQUIRED');
    this.baseUrl = (config.baseUrl ?? 'https://api.resend.com').replace(/\/$/, '');
    this.timeoutMs = config.requestTimeoutMs ?? 10_000;
  }
  async send(input: SendNotificationInput): Promise<NotificationDeliveryResult> {
    if (input.channel !== 'EMAIL') throw new Error('RESEND_EMAIL_ONLY');
    if (!input.subject) throw new Error('RESEND_SUBJECT_REQUIRED');
    const response = await fetch(`${this.baseUrl}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({ from: input.sender ?? this.config.defaultFrom, to: [input.destination], subject: input.subject, text: input.text, ...(input.html ? { html: input.html } : {}) }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const body = record(await response.json());
    if (!response.ok) return { providerCode: this.code, status: 'FAILED', rawStatus: `HTTP_${response.status}` };
    const providerReference = text(body['id']);
    return { providerCode: this.code, ...(providerReference ? { providerReference } : {}), status: providerReference ? 'ACCEPTED' : 'UNKNOWN', rawStatus: 'accepted' };
  }
}
