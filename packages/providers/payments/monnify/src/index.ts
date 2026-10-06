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

export interface MonnifyConfig {
  apiKey: string;
  secretKey: string;
  contractCode: string;
  sourceAccountNumber?: string;
  baseUrl?: string;
  requestTimeoutMs?: number;
  allowUnsignedSandboxWebhooks?: boolean;
}

type UnknownRecord = Record<string, unknown>;
function record(value: unknown, name = 'value'): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`MONNIFY_INVALID_${name.toUpperCase()}`);
  return value as UnknownRecord;
}
function text(value: unknown): string | undefined { return typeof value === 'string' ? value : undefined; }
function asArray(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function header(input: RawWebhookRequest, name: string): string | undefined {
  const lower = name.toLowerCase();
  const pair = Object.entries(input.headers).find(([key]) => key.toLowerCase() === lower);
  const value = pair?.[1];
  if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : undefined;
  return typeof value === 'string' ? value : undefined;
}
function secureEqualsHex(expected: string, actual: string): boolean {
  if (!/^[a-f0-9]+$/i.test(actual) || expected.length !== actual.length) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));
}
function hashPayload(raw: Uint8Array): string { return createHash('sha256').update(raw).digest('hex'); }
function status(value: unknown): NormalizedProviderStatus {
  const raw = String(value ?? '').toUpperCase();
  if (['PAID', 'SUCCESS', 'SUCCESSFUL', 'COMPLETED'].includes(raw)) return 'SUCCEEDED';
  if (['PENDING_AUTHORIZATION'].includes(raw)) return 'REQUIRES_ACTION';
  if (['PENDING', 'AWAITING_PROCESSING', 'IN_PROGRESS', 'PROCESSING'].includes(raw)) return 'PROCESSING';
  if (['REVERSED'].includes(raw)) return 'REVERSED';
  if (['FAILED', 'EXPIRED', 'CANCELLED'].includes(raw)) return 'FAILED';
  return 'UNKNOWN';
}

function majorToMinor(value: unknown): bigint | undefined {
  const raw = typeof value === 'number' && Number.isFinite(value) ? String(value) : typeof value === 'string' ? value.trim() : '';
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(raw);
  if (!match) return undefined;
  const wholePart = match[1];
  if (!wholePart) return undefined;
  const whole = BigInt(wholePart);
  const fraction = (match[2] ?? '').padEnd(2, '0');
  return whole * 100n + BigInt(fraction || '0');
}

function majorNgn(amountMinor: bigint): number {
  if (amountMinor <= 0n || amountMinor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('MONNIFY_AMOUNT_OUT_OF_RANGE');
  return Number(amountMinor) / 100;
}

export class MonnifyAdapter implements PaymentProviderPort {
  readonly code = 'monnify';
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private token?: { value: string; expiresAt: number };

  constructor(private readonly config: MonnifyConfig) {
    if (!config.apiKey || !config.secretKey || !config.contractCode) throw new Error('MONNIFY_CREDENTIALS_REQUIRED');
    this.baseUrl = (config.baseUrl ?? 'https://sandbox.monnify.com').replace(/\/$/, '');
    this.timeoutMs = config.requestTimeoutMs ?? 12_000;
  }

  async createCollection(input: CreateCollectionInput): Promise<CollectionResult> {
    this.assertNgn(input.currency);
    const body = await this.authorized('POST', '/api/v1/merchant/transactions/init-transaction', {
      amount: majorNgn(input.amountMinor),
      customerName: input.customer.fullName ?? ([input.customer.firstName, input.customer.lastName].filter(Boolean).join(' ') || input.customer.email),
      customerEmail: input.customer.email,
      paymentReference: input.reference,
      paymentDescription: 'TwiPay payment',
      currencyCode: input.currency,
      contractCode: this.config.contractCode,
      ...(input.callbackUrl ? { redirectUrl: input.callbackUrl } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    });
    const data = record(body['responseBody'], 'response_body');
    const providerReference = text(data['transactionReference']) ?? input.reference;
    const checkoutUrl = text(data['checkoutUrl']);
    return {
      providerCode: this.code,
      providerReference,
      merchantReference: input.reference,
      status: 'PENDING',
      ...(checkoutUrl ? { checkoutUrl } : {}),
    };
  }

  async getCollection(input: GetCollectionInput): Promise<CollectionResult> {
    const body = await this.authorized('GET', `/api/v2/merchant/transactions/query?paymentReference=${encodeURIComponent(input.merchantReference)}`);
    const data = record(body['responseBody'], 'response_body');
    const rawStatus = text(data['paymentStatus']) ?? 'UNKNOWN';
    const amountPaid = majorToMinor(data['amountPaid']);
    const currency = text(data['currencyCode']);
    return {
      providerCode: this.code,
      providerReference: text(data['transactionReference']) ?? input.providerReference ?? input.merchantReference,
      merchantReference: input.merchantReference,
      status: status(rawStatus),
      ...(amountPaid !== undefined ? { amountMinor: amountPaid } : {}),
      ...(currency && /^[A-Z]{3}$/.test(currency) ? { currency: currency as 'NGN' | 'USD' | 'GBP' | 'EUR' } : {}),
      rawStatus,
    };
  }

  async createVirtualAccount(input: CreateVirtualAccountInput): Promise<VirtualAccountResult> {
    this.assertNgn(input.currency);
    const identity = input.identity;
    if (!identity?.bvn && !identity?.nin) throw new Error('MONNIFY_BVN_OR_NIN_REQUIRED');
    const payload: Record<string, unknown> = {
      accountReference: input.reference,
      accountName: input.customer.fullName ?? ([input.customer.firstName, input.customer.lastName].filter(Boolean).join(' ') || input.customer.email),
      currencyCode: input.currency,
      contractCode: this.config.contractCode,
      customerEmail: input.customer.email,
      customerName: input.customer.fullName ?? ([input.customer.firstName, input.customer.lastName].filter(Boolean).join(' ') || input.customer.email),
      getAllAvailableBanks: true,
    };
    if (identity.bvn) payload['bvn'] = identity.bvn;
    if (identity.nin) payload['nin'] = identity.nin;
    const body = await this.authorized('POST', '/api/v2/bank-transfer/reserved-accounts', payload);
    const data = record(body['responseBody'], 'response_body');
    const account = record(asArray(data['accounts'])[0], 'account');
    const accountNumber = text(account['accountNumber']);
    const bankName = text(account['bankName']);
    if (!accountNumber || !bankName) throw new Error('MONNIFY_RESERVED_ACCOUNT_MISSING');
    const bankCode = text(account['bankCode']);
    return {
      providerCode: this.code,
      providerAccountId: text(data['accountReference']) ?? input.reference,
      reference: input.reference,
      accountNumber,
      accountName: text(account['accountName']) ?? text(data['accountName']) ?? input.customer.email,
      ...(bankCode ? { bankCode } : {}),
      bankName,
      currency: input.currency,
      status: 'ACTIVE',
    };
  }

  async resolveBankAccount(input: ResolveBankAccountInput): Promise<ResolvedBankAccount> {
    this.assertNgn(input.currency);
    const query = new URLSearchParams({ accountNumber: input.accountNumber, bankCode: input.bankCode });
    const body = await this.authorized('GET', `/api/v2/disbursements/account/validate?${query.toString()}`);
    const data = record(body['responseBody'], 'response_body');
    const accountName = text(data['accountName']);
    const accountNumber = text(data['accountNumber']);
    if (!accountName || !accountNumber) throw new Error('MONNIFY_ACCOUNT_RESOLUTION_MISSING');
    const bankName = text(data['bankName']);
    return {
      providerCode: this.code,
      bankCode: text(data['bankCode']) ?? input.bankCode,
      accountNumber,
      accountName,
      ...(bankName ? { bankName } : {}),
      currency: input.currency,
    };
  }

  async createPayout(input: CreatePayoutInput): Promise<PayoutResult> {
    this.assertNgn(input.currency);
    if (!this.config.sourceAccountNumber) throw new Error('MONNIFY_SOURCE_ACCOUNT_REQUIRED');
    const body = await this.authorized('POST', '/api/v2/disbursements/single', {
      amount: majorNgn(input.amountMinor),
      reference: input.reference,
      narration: input.narration,
      destinationBankCode: input.beneficiary.bankCode,
      destinationAccountNumber: input.beneficiary.accountNumber,
      destinationAccountName: input.beneficiary.accountName,
      currency: input.currency,
      sourceAccountNumber: this.config.sourceAccountNumber,
      async: true,
      ...(input.sender ? { senderInfo: {
        ...(input.sender.name ? { sourceAccountName: input.sender.name } : {}),
        ...(input.sender.accountNumber ? { sourceAccountNumber: input.sender.accountNumber } : {}),
        ...(input.sender.bankCode ? { senderBankCode: input.sender.bankCode } : {}),
      } } : {}),
    });
    const data = record(body['responseBody'], 'response_body');
    const rawStatus = text(data['status']) ?? 'UNKNOWN';
    const fee = majorToMinor(data['totalFee']);
    const providerReference = text(data['transactionReference']);
    const amountMinor = majorToMinor(data['amount']);
    const currency = text(data['currency']);
    return {
      providerCode: this.code,
      ...(providerReference ? { providerReference } : {}),
      merchantReference: input.reference,
      status: status(rawStatus),
      ...(amountMinor !== undefined ? { amountMinor } : {}),
      ...(currency ? { currency: currency as 'NGN' | 'USD' | 'GBP' | 'EUR' } : {}),
      ...(fee !== undefined ? { feeMinor: fee } : {}),
      rawStatus,
      requiresAuthorization: rawStatus === 'PENDING_AUTHORIZATION',
    };
  }

  async getPayout(input: GetPayoutInput): Promise<PayoutResult> {
    const body = await this.authorized('GET', `/api/v2/disbursements/single/summary?reference=${encodeURIComponent(input.merchantReference)}`);
    const data = record(body['responseBody'], 'response_body');
    const rawStatus = text(data['status']) ?? 'UNKNOWN';
    const fee = majorToMinor(data['fee']);
    const providerReference = text(data['transactionReference']) ?? input.providerReference;
    const amountMinor = majorToMinor(data['amount']);
    const currency = text(data['currency']);
    return {
      providerCode: this.code,
      ...(providerReference ? { providerReference } : {}),
      merchantReference: input.merchantReference,
      status: status(rawStatus),
      ...(amountMinor !== undefined ? { amountMinor } : {}),
      ...(currency ? { currency: currency as 'NGN' | 'USD' | 'GBP' | 'EUR' } : {}),
      ...(fee !== undefined ? { feeMinor: fee } : {}),
      rawStatus,
    };
  }

  async verifyWebhook(input: RawWebhookRequest): Promise<VerifiedWebhook> {
    const signature = header(input, 'monnify-signature');
    const unsignedAllowed = Boolean(this.config.allowUnsignedSandboxWebhooks && this.baseUrl.includes('sandbox.monnify.com'));
    if (!signature && !unsignedAllowed) throw new Error('MONNIFY_WEBHOOK_SIGNATURE_MISSING');
    if (signature) {
      const expected = createHmac('sha512', this.config.secretKey).update(input.rawBody).digest('hex');
      if (!secureEqualsHex(expected, signature)) throw new Error('MONNIFY_WEBHOOK_SIGNATURE_INVALID');
    }
    const payload = record(JSON.parse(Buffer.from(input.rawBody).toString('utf8')), 'webhook');
    const eventType = text(payload['eventType']) ?? 'unknown';
    const data = payload['eventData'] && typeof payload['eventData'] === 'object' ? record(payload['eventData'], 'event_data') : {};
    const merchantReference = text(data['paymentReference']) ?? text(data['reference']);
    const providerReference = text(data['transactionReference']);
    const rawStatus = text(data['paymentStatus']) ?? text(data['status']);
    const externalEventId = providerReference ?? merchantReference;

    let virtualAccountCredit: VerifiedWebhook['virtualAccountCredit'];
    const product = data['product'] && typeof data['product'] === 'object' ? record(data['product'], 'product') : {};
    const destinationAccount = data['destinationAccountInformation'] && typeof data['destinationAccountInformation'] === 'object'
      ? record(data['destinationAccountInformation'], 'destination_account_information')
      : {};
    if (eventType === 'SUCCESSFUL_TRANSACTION' && text(product['type']) === 'RESERVED_ACCOUNT' && merchantReference) {
      const amountMinor = majorToMinor(data['amountPaid']);
      const currency = text(data['currency']);
      virtualAccountCredit = {
        collectionReference: merchantReference,
        ...(providerReference ? { providerReference } : {}),
        ...(text(product['reference']) ? { accountReference: text(product['reference'])! } : {}),
        ...(text(destinationAccount['accountNumber'])
          ? { accountNumber: text(destinationAccount['accountNumber'])! }
          : {}),
        ...(amountMinor !== undefined ? { amountMinor } : {}),
        ...(currency && /^[A-Z]{3}$/.test(currency) ? { currency: currency as 'NGN' | 'USD' | 'GBP' | 'EUR' } : {}),
      };
    }

    return {
      providerCode: this.code,
      eventType,
      ...(externalEventId ? { externalEventId } : {}),
      ...(merchantReference ? { merchantReference } : {}),
      ...(providerReference ? { providerReference } : {}),
      ...(rawStatus ? { status: status(rawStatus) } : {}),
      ...(virtualAccountCredit ? { virtualAccountCredit } : {}),
      payloadHash: hashPayload(input.rawBody),
      normalizedPayload: {
        eventType,
        merchantReference: merchantReference ?? null,
        providerReference: providerReference ?? null,
        status: rawStatus ?? null,
      },
    };
  }

  private assertNgn(currency: string): void {
    if (currency !== 'NGN') throw new Error('MONNIFY_BATCH2_SUPPORTS_NGN_ONLY');
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 300_000) return this.token.value;
    const credentials = Buffer.from(`${this.config.apiKey}:${this.config.secretKey}`).toString('base64');
    const response = await fetch(`${this.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const body = record(await response.json(), 'auth_response');
    if (!response.ok || body['requestSuccessful'] === false) throw new Error(`MONNIFY_AUTH_HTTP_${response.status}`);
    const responseBody = record(body['responseBody'], 'auth_body');
    const token = text(responseBody['accessToken']);
    if (!token) throw new Error('MONNIFY_ACCESS_TOKEN_MISSING');
    const expiresIn = typeof responseBody['expiresIn'] === 'number' ? responseBody['expiresIn'] : 3600;
    this.token = { value: token, expiresAt: Date.now() + expiresIn * 1000 };
    return token;
  }

  private async authorized(method: 'GET' | 'POST', path: string, payload?: Record<string, unknown>): Promise<UnknownRecord> {
    const token = await this.accessToken();
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(payload ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const body = record(await response.json(), 'response');
    if (!response.ok || body['requestSuccessful'] === false) throw new Error(`MONNIFY_HTTP_${response.status}`);
    return body;
  }
}
