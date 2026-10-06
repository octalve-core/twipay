import { createHash } from 'node:crypto';
import type {
  BillCategory,
  BillCustomerValidationInput,
  BillCustomerValidationResult,
  BillProductDescriptor,
  BillProviderPort,
  BillPurchaseInput,
  BillPurchaseResult,
  BillQueryInput,
  CurrencyCode,
  JsonObject,
  ListBillProductsInput,
  NormalizedProviderStatus,
} from '@twipay/contracts';

export interface VtpassConfig {
  apiKey: string;
  publicKey: string;
  secretKey: string;
  baseUrl?: string;
  requestTimeoutMs?: number;
}

type UnknownRecord = Record<string, unknown>;
function record(value: unknown, name: string): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`VTPASS_INVALID_${name.toUpperCase()}`);
  return value as UnknownRecord;
}
function text(value: unknown): string | undefined { return typeof value === 'string' ? value : undefined; }
function num(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}
function majorToMinor(value: unknown): bigint | undefined {
  const n = num(value);
  if (n === undefined || n < 0) return undefined;
  return BigInt(Math.round(n * 100));
}
function minorToMajor(amountMinor: bigint): number {
  if (amountMinor <= 0n || amountMinor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('VTPASS_AMOUNT_OUT_OF_RANGE');
  return Number(amountMinor) / 100;
}
function providerStatus(body: UnknownRecord): NormalizedProviderStatus {
  const transaction = body['content'] && typeof body['content'] === 'object'
    ? record(record(body['content'], 'content')['transactions'] ?? {}, 'transactions')
    : {};
  const inner = String(transaction['status'] ?? '').toLowerCase();
  if (['delivered', 'successful', 'success'].includes(inner)) return 'SUCCEEDED';
  if (['pending', 'processing', 'initiated'].includes(inner)) return 'PROCESSING';
  if (inner === 'reversed') return 'REVERSED';
  if (['failed', 'declined'].includes(inner)) return 'FAILED';
  const code = String(body['code'] ?? '');
  // VTpass documents code 000 as 'request processed', but the actual
  // transaction state is carried by the nested transaction status. Without
  // that evidence we remain UNKNOWN rather than manufacturing success.
  if (code === '099') return 'PROCESSING';
  if (code === '040') return 'REVERSED';
  if (['010', '011', '012', '013', '016', '017', '018', '091'].includes(code)) return 'FAILED';
  if (code === '014') return 'UNKNOWN';
  if (code === '000') return 'UNKNOWN';
  return 'UNKNOWN';
}
function categoryIdentifier(category: BillCategory): string {
  switch (category) {
    case 'AIRTIME': return 'airtime';
    case 'DATA': return 'data';
    case 'ELECTRICITY': return 'electricity-bill';
    case 'CABLE': return 'tv-subscription';
  }
}
function customerType(category: BillCategory): BillProductDescriptor['customerIdentifierType'] {
  if (category === 'ELECTRICITY') return 'METER';
  if (category === 'CABLE') return 'SMARTCARD';
  return 'PHONE';
}
function lagosPrefix(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}${get('month')}${get('day')}${get('hour')}${get('minute')}`;
}
export function vtpassRequestId(merchantReference: string, now = new Date()): string {
  const suffix = createHash('sha256').update(merchantReference).digest('hex').slice(0, 20);
  return `${lagosPrefix(now)}${suffix}`;
}
function asCurrency(value: string | undefined): CurrencyCode | undefined {
  return value && ['NGN', 'USD', 'GBP', 'EUR'].includes(value) ? value as CurrencyCode : undefined;
}

export class VtpassAdapter implements BillProviderPort {
  readonly code = 'vtpass';
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: VtpassConfig) {
    if (!config.apiKey || !config.publicKey || !config.secretKey) throw new Error('VTPASS_CREDENTIALS_REQUIRED');
    this.baseUrl = (config.baseUrl ?? 'https://sandbox.vtpass.com').replace(/\/$/, '');
    this.timeoutMs = config.requestTimeoutMs ?? 15_000;
  }

  createPurchaseRequestReference(merchantReference: string): string {
    return vtpassRequestId(merchantReference);
  }

  async listProducts(input: ListBillProductsInput): Promise<readonly BillProductDescriptor[]> {
    const servicesBody = await this.request('GET', `/api/services?identifier=${encodeURIComponent(categoryIdentifier(input.category))}`);
    const services = Array.isArray(servicesBody['content']) ? servicesBody['content'] : [];
    const products: BillProductDescriptor[] = [];
    for (const raw of services) {
      const service = record(raw, 'service');
      const serviceId = text(service['serviceID']);
      const serviceName = text(service['name']) ?? serviceId;
      if (!serviceId || !serviceName) continue;
      if (input.providerBillerCode && serviceId !== input.providerBillerCode) continue;
      const minAmountMinor = majorToMinor(service['minimium_amount'] ?? service['minimum_amount']);
      const maxAmountMinor = majorToMinor(service['maximum_amount']);
      if (input.category === 'AIRTIME') {
        products.push({
          providerCode: this.code,
          providerProductCode: serviceId,
          providerBillerCode: serviceId,
          category: input.category,
          name: serviceName,
          customerIdentifierType: 'PHONE',
          currency: 'NGN',
          ...(minAmountMinor !== undefined ? { minAmountMinor } : {}),
          ...(maxAmountMinor !== undefined ? { maxAmountMinor } : {}),
          requiresCustomerValidation: false,
        });
        continue;
      }
      const variationsBody = await this.request('GET', `/api/service-variations?serviceID=${encodeURIComponent(serviceId)}`);
      const content = record(variationsBody['content'], 'variations_content');
      const variations = Array.isArray(content['variations']) ? content['variations'] : [];
      for (const rawVariation of variations) {
        const variation = record(rawVariation, 'variation');
        const code = text(variation['variation_code']);
        const name = text(variation['name']);
        if (!code || !name) continue;
        const fixed = String(variation['fixedPrice'] ?? '').toLowerCase() === 'yes';
        const fixedAmountMinor = fixed ? majorToMinor(variation['variation_amount']) : undefined;
        products.push({
          providerCode: this.code,
          providerProductCode: code,
          providerBillerCode: serviceId,
          category: input.category,
          name,
          customerIdentifierType: customerType(input.category),
          currency: 'NGN',
          ...(fixedAmountMinor !== undefined ? { fixedAmountMinor } : {}),
          ...(!fixed && minAmountMinor !== undefined ? { minAmountMinor } : {}),
          ...(!fixed && maxAmountMinor !== undefined ? { maxAmountMinor } : {}),
          requiresCustomerValidation: input.category === 'ELECTRICITY' || input.category === 'CABLE',
          metadata: { serviceName },
        });
      }
    }
    return products;
  }

  async validateCustomer(input: BillCustomerValidationInput): Promise<BillCustomerValidationResult> {
    if (input.category !== 'ELECTRICITY' && input.category !== 'CABLE') {
      return { providerCode: this.code, valid: true, requiresValidationReference: false };
    }
    const payload: Record<string, unknown> = {
      billersCode: input.customerIdentifier,
      serviceID: input.providerBillerCode,
      ...(input.category === 'ELECTRICITY' ? { type: input.providerProductCode } : {}),
    };
    const body = await this.request('POST', '/api/merchant-verify', payload);
    const content = body['content'] && typeof body['content'] === 'object' ? record(body['content'], 'verify_content') : {};
    const code = String(body['code'] ?? '');
    const wrong = content['WrongBillersCode'] === true;
    const customerName = text(content['Customer_Name']) ?? text(content['customer_name']);
    return {
      providerCode: this.code,
      valid: code === '000' && !wrong,
      requiresValidationReference: false,
      ...(customerName ? { customerName } : {}),
      rawStatus: code || 'unknown',
    };
  }

  async purchase(input: BillPurchaseInput): Promise<BillPurchaseResult> {
    if (input.currency !== 'NGN') throw new Error('VTPASS_SUPPORTS_NGN_ONLY');
    const requestId = input.providerRequestReference;
    if (!requestId) throw new Error('VTPASS_REQUEST_REFERENCE_REQUIRED');
    const phone = input.category === 'AIRTIME' || input.category === 'DATA'
      ? input.customerIdentifier
      : input.contactPhoneE164;
    if (!phone) throw new Error('VTPASS_CONTACT_PHONE_REQUIRED');
    const payload: Record<string, unknown> = {
      request_id: requestId,
      serviceID: input.providerBillerCode,
      amount: minorToMajor(input.amountMinor),
      phone,
      ...(input.category === 'AIRTIME' ? {} : { billersCode: input.customerIdentifier, variation_code: input.providerProductCode }),
      ...(input.category === 'CABLE' && ['dstv', 'gotv'].includes(input.providerBillerCode) ? { subscription_type: 'change' } : {}),
    };
    const body = await this.request('POST', '/api/pay', payload);
    return this.normalizePurchase(input.reference, requestId, body);
  }

  async queryTransaction(input: BillQueryInput): Promise<BillPurchaseResult> {
    if (!input.providerRequestReference) throw new Error('VTPASS_REQUEST_REFERENCE_REQUIRED');
    const body = await this.request('POST', '/api/requery', { request_id: input.providerRequestReference });
    return this.normalizePurchase(input.merchantReference, input.providerRequestReference, body);
  }

  private normalizePurchase(merchantReference: string, requestId: string, body: UnknownRecord): BillPurchaseResult {
    const content = body['content'] && typeof body['content'] === 'object' ? record(body['content'], 'content') : {};
    const transaction = content['transactions'] && typeof content['transactions'] === 'object' ? record(content['transactions'], 'transaction') : {};
    const rawStatus = text(transaction['status']) ?? String(body['code'] ?? 'unknown');
    const amountMinor = majorToMinor(body['amount'] ?? transaction['amount']);
    const commissionMinor = majorToMinor(transaction['commission']);
    const providerReference = transaction['transactionId'] === undefined ? undefined : String(transaction['transactionId']);
    const fulfillmentValue = text(body['purchased_code']);
    return {
      providerCode: this.code,
      merchantReference,
      ...(providerReference ? { providerReference } : {}),
      providerRequestReference: requestId,
      status: providerStatus(body),
      ...(amountMinor !== undefined ? { amountMinor } : {}),
      currency: 'NGN',
      ...(fulfillmentValue ? { fulfillmentValue } : {}),
      ...(commissionMinor !== undefined ? { commissionMinor } : {}),
      rawStatus,
    };
  }

  private async request(method: 'GET' | 'POST', path: string, payload?: Record<string, unknown>): Promise<UnknownRecord> {
    const isPost = method === 'POST';
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'api-key': this.config.apiKey,
        ...(isPost ? { 'secret-key': this.config.secretKey } : { 'public-key': this.config.publicKey }),
        Accept: 'application/json',
        ...(payload ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const body = record(await response.json(), 'response');
    if (!response.ok) throw new Error(`VTPASS_HTTP_${response.status}`);
    return body;
  }
}
