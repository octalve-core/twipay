import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type {
  CollectionResult,
  CreateCollectionInput,
  CreatePayoutInput,
  CreateVirtualAccountInput,
  GetCollectionInput,
  GetPayoutInput,
  NormalizedProviderStatus,
  PaymentProviderPort,
  PayoutResult,
  RawWebhookRequest,
  ResolveBankAccountInput,
  ResolvedBankAccount,
  VerifiedWebhook,
  VirtualAccountResult,
} from '@twipay/contracts';

export interface PaystackConfig {
  secretKey: string;
  baseUrl?: string;
  requestTimeoutMs?: number;
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown, name = 'value'): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`PAYSTACK_INVALID_${name.toUpperCase()}`);
  return value as UnknownRecord;
}
function text(value: unknown): string | undefined { return typeof value === 'string' ? value : undefined; }
function num(value: unknown): number | undefined { return typeof value === 'number' && Number.isFinite(value) ? value : undefined; }
function bool(value: unknown): boolean | undefined { return typeof value === 'boolean' ? value : undefined; }
function safeMinor(amountMinor: bigint): number {
  if (amountMinor <= 0n || amountMinor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('PAYSTACK_AMOUNT_OUT_OF_RANGE');
  return Number(amountMinor);
}
function header(input: RawWebhookRequest, name: string): string | undefined {
  const value = input.headers[name] ?? input.headers[name.toLowerCase()];
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined;
  return typeof value === 'string' ? value : undefined;
}
function secureEqualsHex(expected: string, actual: string): boolean {
  if (!/^[a-f0-9]+$/i.test(actual) || expected.length !== actual.length) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));
}
function hashPayload(raw: Uint8Array): string { return createHash('sha256').update(raw).digest('hex'); }
function status(value: unknown): NormalizedProviderStatus {
  const raw = String(value ?? '').toLowerCase();
  if (['success', 'successful'].includes(raw)) return 'SUCCEEDED';
  if (['pending', 'processing', 'ongoing', 'queued'].includes(raw)) return 'PROCESSING';
  if (['otp', 'requires_action'].includes(raw)) return 'REQUIRES_ACTION';
  if (['reversed', 'reversal'].includes(raw)) return 'REVERSED';
  if (['failed', 'abandoned', 'declined'].includes(raw)) return 'FAILED';
  return 'UNKNOWN';
}

export class PaystackAdapter implements PaymentProviderPort {
  readonly code = 'paystack';
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: PaystackConfig) {
    if (!config.secretKey) throw new Error('PAYSTACK_SECRET_KEY_REQUIRED');
    this.baseUrl = (config.baseUrl ?? 'https://api.paystack.co').replace(/\/$/, '');
    this.timeoutMs = config.requestTimeoutMs ?? 12_000;
  }

  async createCollection(input: CreateCollectionInput): Promise<CollectionResult> {
    const body = await this.request('POST', '/transaction/initialize', {
      email: input.customer.email,
      amount: safeMinor(input.amountMinor),
      currency: input.currency,
      reference: input.reference,
      ...(input.callbackUrl ? { callback_url: input.callbackUrl } : {}),
      ...(input.rails?.length ? { channels: input.rails.map((rail) => rail.toLowerCase()) } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    });
    const data = record(body['data'], 'data');
    const providerReference = text(data['reference']) ?? input.reference;
    const checkoutUrl = text(data['authorization_url']);
    return {
      providerCode: this.code,
      providerReference,
      merchantReference: input.reference,
      status: 'PENDING',
      ...(checkoutUrl ? { checkoutUrl } : {}),
    };
  }

  async getCollection(input: GetCollectionInput): Promise<CollectionResult> {
    const body = await this.request('GET', `/transaction/verify/${encodeURIComponent(input.merchantReference)}`);
    const data = record(body['data'], 'data');
    const rawStatus = text(data['status']) ?? 'unknown';
    const rawAmount = num(data['amount']);
    const rawCurrency = text(data['currency']);
    return {
      providerCode: this.code,
      providerReference: text(data['reference']) ?? input.providerReference ?? input.merchantReference,
      merchantReference: input.merchantReference,
      status: status(rawStatus),
      ...(rawAmount !== undefined && Number.isInteger(rawAmount) ? { amountMinor: BigInt(rawAmount) } : {}),
      ...(rawCurrency && /^[A-Z]{3}$/.test(rawCurrency) ? { currency: rawCurrency as 'NGN' | 'USD' | 'GBP' | 'EUR' } : {}),
      rawStatus,
    };
  }

  async createVirtualAccount(input: CreateVirtualAccountInput): Promise<VirtualAccountResult> {
    if (!input.identity?.bvn || !input.identity.bankAccountNumber || !input.identity.bankCode) {
      throw new Error('PAYSTACK_DVA_FINANCIAL_IDENTITY_FIELDS_REQUIRED');
    }
    const payload: Record<string, unknown> = {
      email: input.customer.email,
      first_name: input.customer.firstName ?? input.customer.fullName?.split(' ')[0] ?? 'TwiPay',
      last_name: input.customer.lastName ?? (input.customer.fullName?.split(' ').slice(1).join(' ') || 'Customer'),
      ...(input.customer.phoneE164 ? { phone: input.customer.phoneE164 } : {}),
      ...(input.preferredBank ? { preferred_bank: input.preferredBank } : {}),
      country: 'NG',
      bvn: input.identity.bvn,
      account_number: input.identity.bankAccountNumber,
      bank_code: input.identity.bankCode,
    };
    const body = await this.request('POST', '/dedicated_account/assign', payload);
    const data = body['data'] && typeof body['data'] === 'object' ? record(body['data'], 'data') : {};
    const bank = data['bank'] && typeof data['bank'] === 'object' ? record(data['bank'], 'bank') : {};
    const accountNumber = text(data['account_number']);
    const providerId = data['id'] === undefined ? undefined : String(data['id']);
    if (!accountNumber || !providerId) {
      return {
        providerCode: this.code,
        reference: input.reference,
        currency: input.currency,
        status: 'PENDING',
      };
    }
    return {
      providerCode: this.code,
      providerAccountId: providerId,
      reference: input.reference,
      accountNumber,
      accountName: text(data['account_name']) ?? input.customer.fullName ?? input.customer.email,
      bankName: text(bank['name']) ?? input.preferredBank ?? 'Paystack',
      currency: input.currency,
      status: bool(data['active']) === false ? 'INACTIVE' : 'ACTIVE',
    };
  }

  async resolveBankAccount(input: ResolveBankAccountInput): Promise<ResolvedBankAccount> {
    const query = new URLSearchParams({ account_number: input.accountNumber, bank_code: input.bankCode });
    const body = await this.request('GET', `/bank/resolve?${query.toString()}`);
    const data = record(body['data'], 'account_data');
    const accountName = text(data['account_name']);
    const accountNumber = text(data['account_number']);
    if (!accountName || !accountNumber) throw new Error('PAYSTACK_ACCOUNT_RESOLUTION_MISSING');
    return {
      providerCode: this.code,
      bankCode: input.bankCode,
      accountNumber,
      accountName,
      currency: input.currency,
    };
  }

  async createPayout(input: CreatePayoutInput): Promise<PayoutResult> {
    const recipientResponse = await this.request('POST', '/transferrecipient', {
      type: 'nuban',
      name: input.beneficiary.accountName,
      account_number: input.beneficiary.accountNumber,
      bank_code: input.beneficiary.bankCode,
      currency: input.currency,
    });
    const recipientData = record(recipientResponse['data'], 'recipient_data');
    const recipient = text(recipientData['recipient_code']);
    if (!recipient) throw new Error('PAYSTACK_RECIPIENT_CODE_MISSING');
    const transferResponse = await this.request('POST', '/transfer', {
      source: 'balance',
      amount: safeMinor(input.amountMinor),
      reference: input.reference,
      recipient,
      reason: input.narration,
      currency: input.currency,
    });
    const data = record(transferResponse['data'], 'transfer_data');
    const rawStatus = text(data['status']) ?? 'pending';
    const amount = num(data['amount']);
    const currency = text(data['currency']);
    return {
      providerCode: this.code,
      ...(data['transfer_code'] ? { providerReference: String(data['transfer_code']) } : {}),
      merchantReference: input.reference,
      status: status(rawStatus),
      ...(amount !== undefined && Number.isInteger(amount) ? { amountMinor: BigInt(amount) } : {}),
      ...(currency && /^[A-Z]{3}$/.test(currency) ? { currency: currency as 'NGN' | 'USD' | 'GBP' | 'EUR' } : {}),
      rawStatus,
      requiresAuthorization: rawStatus.toLowerCase() === 'otp',
    };
  }

  async getPayout(input: GetPayoutInput): Promise<PayoutResult> {
    const body = await this.request('GET', `/transfer/verify/${encodeURIComponent(input.merchantReference)}`);
    const data = record(body['data'], 'transfer_data');
    const rawStatus = text(data['status']) ?? 'unknown';
    const amount = num(data['amount']);
    const currency = text(data['currency']);
    return {
      providerCode: this.code,
      ...(data['transfer_code'] ? { providerReference: String(data['transfer_code']) } : input.providerReference ? { providerReference: input.providerReference } : {}),
      merchantReference: input.merchantReference,
      status: status(rawStatus),
      ...(amount !== undefined && Number.isInteger(amount) ? { amountMinor: BigInt(amount) } : {}),
      ...(currency && /^[A-Z]{3}$/.test(currency) ? { currency: currency as 'NGN' | 'USD' | 'GBP' | 'EUR' } : {}),
      rawStatus,
    };
  }

  async verifyWebhook(input: RawWebhookRequest): Promise<VerifiedWebhook> {
    const signature = header(input, 'x-paystack-signature');
    if (!signature) throw new Error('PAYSTACK_WEBHOOK_SIGNATURE_MISSING');
    const expected = createHmac('sha512', this.config.secretKey).update(input.rawBody).digest('hex');
    if (!secureEqualsHex(expected, signature)) throw new Error('PAYSTACK_WEBHOOK_SIGNATURE_INVALID');
    const payload = record(JSON.parse(Buffer.from(input.rawBody).toString('utf8')), 'webhook');
    const eventType = text(payload['event']) ?? 'unknown';
    const data = payload['data'] && typeof payload['data'] === 'object' ? record(payload['data'], 'data') : {};
    const externalEventId = data['id'] === undefined ? undefined : String(data['id']);
    const merchantReference = text(data['reference']);
    const rawStatus = text(data['status']);

    let virtualAccountAssignment: VerifiedWebhook['virtualAccountAssignment'];
    const assignmentSucceeded = eventType === 'dedicatedaccount.assign.success' || eventType === 'assigndedicatedaccount.success';
    const assignmentFailed = eventType === 'dedicatedaccount.assign.failed' || eventType === 'assigndedicatedaccount.failed';
    if (assignmentSucceeded || assignmentFailed) {
      const customer = data['customer'] && typeof data['customer'] === 'object' ? record(data['customer'], 'customer') : {};
      const dedicated = data['dedicated_account'] && typeof data['dedicated_account'] === 'object'
        ? record(data['dedicated_account'], 'dedicated_account')
        : data;
      const bank = dedicated['bank'] && typeof dedicated['bank'] === 'object' ? record(dedicated['bank'], 'bank') : {};
      const assignedAccountNumber = text(dedicated['account_number']);
      const assignedId = dedicated['id'] === undefined ? undefined : String(dedicated['id']);
      const customerEmail = text(customer['email']) ?? text(data['email']);
      virtualAccountAssignment = {
        status: assignmentSucceeded ? 'ACTIVE' : 'FAILED',
        ...(customerEmail ? { customerEmail } : {}),
        ...(assignedId ? { providerAccountId: assignedId } : {}),
        ...(assignedAccountNumber ? { accountNumber: assignedAccountNumber } : {}),
        ...(text(dedicated['account_name']) ? { accountName: text(dedicated['account_name'])! } : {}),
        ...(text(bank['name']) ? { bankName: text(bank['name'])! } : {}),
        ...(text(dedicated['currency']) && /^[A-Z]{3}$/.test(text(dedicated['currency'])!)
          ? { currency: text(dedicated['currency']) as 'NGN' | 'USD' | 'GBP' | 'EUR' }
          : { currency: 'NGN' }),
      };
    }

    let virtualAccountCredit: VerifiedWebhook['virtualAccountCredit'];
    if (eventType === 'charge.success' && merchantReference) {
      const authorization = data['authorization'] && typeof data['authorization'] === 'object'
        ? record(data['authorization'], 'authorization')
        : {};
      const channel = text(authorization['channel']);
      const receiverAccountNumber = text(authorization['receiver_bank_account_number']);
      if (channel === 'dedicated_nuban' && receiverAccountNumber) {
        const amount = num(data['amount']);
        const currency = text(data['currency']);
        virtualAccountCredit = {
          collectionReference: merchantReference,
          ...(externalEventId ? { providerReference: externalEventId } : {}),
          ...(receiverAccountNumber ? { accountNumber: receiverAccountNumber } : {}),
          ...(amount !== undefined && Number.isInteger(amount) ? { amountMinor: BigInt(amount) } : {}),
          ...(currency && /^[A-Z]{3}$/.test(currency) ? { currency: currency as 'NGN' | 'USD' | 'GBP' | 'EUR' } : {}),
        };
      }
    }

    return {
      providerCode: this.code,
      eventType,
      ...(externalEventId ? { externalEventId } : {}),
      ...(merchantReference ? { merchantReference, providerReference: merchantReference } : {}),
      ...(rawStatus ? { status: status(rawStatus) } : {}),
      ...(virtualAccountAssignment ? { virtualAccountAssignment } : {}),
      ...(virtualAccountCredit ? { virtualAccountCredit } : {}),
      payloadHash: hashPayload(input.rawBody),
      normalizedPayload: {
        eventType,
        merchantReference: merchantReference ?? null,
        providerReference: externalEventId ?? merchantReference ?? null,
        status: rawStatus ?? null,
      },
    };
  }

  private async request(method: 'GET' | 'POST', path: string, payload?: Record<string, unknown>): Promise<UnknownRecord> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.config.secretKey}`,
        Accept: 'application/json',
        ...(payload ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const body: unknown = await response.json();
    const parsed = record(body, 'response');
    if (!response.ok || parsed['status'] === false) throw new Error(`PAYSTACK_HTTP_${response.status}`);
    return parsed;
  }
}
