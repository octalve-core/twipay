import type {
  ContinueIdentityCheckInput,
  IdentityCheckResult,
  IdentityVerificationProviderPort,
  InitiateIdentityCheckInput,
  JsonObject,
} from '@twipay/contracts';

export interface MonoConfig {
  secretKey: string;
  baseUrl?: string;
  requestTimeoutMs?: number;
}

type UnknownRecord = Record<string, unknown>;
function record(value: unknown, name = 'value'): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`MONO_INVALID_${name.toUpperCase()}`);
  return value as UnknownRecord;
}
function text(value: unknown): string | undefined { return typeof value === 'string' ? value : undefined; }
function jsonObject(value: unknown): JsonObject { return JSON.parse(JSON.stringify(value)) as JsonObject; }

export class MonoIdentityAdapter implements IdentityVerificationProviderPort {
  readonly code = 'mono';
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: MonoConfig) {
    if (!config.secretKey) throw new Error('MONO_SECRET_KEY_REQUIRED');
    this.baseUrl = (config.baseUrl ?? 'https://api.withmono.com').replace(/\/$/, '');
    this.timeoutMs = config.requestTimeoutMs ?? 12_000;
  }

  async initiateIdentityCheck(input: InitiateIdentityCheckInput): Promise<IdentityCheckResult> {
    if (input.type === 'BVN') {
      if (!/^\d{11}$/.test(input.identifier)) throw new Error('MONO_BVN_FORMAT_INVALID');
      const body = await this.request('POST', '/v2/lookup/bvn/initiate', {
        bvn: input.identifier,
        scope: input.scope ?? 'identity',
      });
      const data = body['data'] && typeof body['data'] === 'object' ? record(body['data'], 'data') : {};
      const sessionId = text(data['session_id']);
      if (!sessionId) throw new Error('MONO_BVN_SESSION_ID_MISSING');
      return {
        providerCode: this.code,
        providerReference: sessionId,
        merchantReference: input.reference,
        status: 'AWAITING_CONSENT',
        attributes: jsonObject({ methods: Array.isArray(data['methods']) ? data['methods'] : [] }),
        ...(text(body['status']) ? { rawStatus: text(body['status'])! } : {}),
      };
    }
    if (input.type === 'NIN') {
      if (!/^\d{11}$/.test(input.identifier)) throw new Error('MONO_NIN_FORMAT_INVALID');
      const body = await this.request('POST', '/v3/lookup/nin', { nin: input.identifier });
      return {
        providerCode: this.code,
        merchantReference: input.reference,
        status: text(body['status'])?.toLowerCase() === 'successful' ? 'VERIFIED' : 'PENDING',
        attributes: jsonObject(body['data'] ?? {}),
        ...(text(body['status']) ? { rawStatus: text(body['status'])! } : {}),
      };
    }
    throw new Error(`MONO_IDENTITY_CHECK_UNSUPPORTED_${input.type}`);
  }

  async continueIdentityCheck(input: ContinueIdentityCheckInput): Promise<IdentityCheckResult> {
    if (input.action === 'REQUEST_OTP') {
      if (!input.verificationMethod) throw new Error('MONO_VERIFICATION_METHOD_REQUIRED');
      const body = await this.request('POST', '/v2/lookup/bvn/verify', {
        method: input.verificationMethod,
        ...(input.phoneNumber ? { phone_number: input.phoneNumber } : {}),
      }, input.providerReference);
      return {
        providerCode: this.code,
        providerReference: input.providerReference,
        merchantReference: input.providerReference,
        status: 'PENDING',
        ...(text(body['status']) ? { rawStatus: text(body['status'])! } : {}),
      };
    }
    if (!input.otp || !/^\d{4,10}$/.test(input.otp)) throw new Error('MONO_OTP_FORMAT_INVALID');
    const body = await this.request('POST', '/v2/lookup/bvn/details', { otp: input.otp }, input.providerReference);
    return {
      providerCode: this.code,
      providerReference: input.providerReference,
      merchantReference: input.providerReference,
      status: text(body['status'])?.toLowerCase() === 'successful' ? 'VERIFIED' : 'FAILED',
      attributes: jsonObject(body['data'] ?? {}),
      ...(text(body['status']) ? { rawStatus: text(body['status'])! } : {}),
    };
  }

  private async request(method: 'POST', path: string, payload: Record<string, unknown>, sessionId?: string): Promise<UnknownRecord> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'mono-sec-key': this.config.secretKey,
        ...(sessionId ? { 'x-session-id': sessionId } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const body = record(await response.json(), 'response');
    if (!response.ok) throw new Error(`MONO_HTTP_${response.status}`);
    return body;
  }
}
