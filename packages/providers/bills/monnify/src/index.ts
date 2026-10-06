import type {
  BillCategory,
  BillCustomerValidationInput,
  BillCustomerValidationResult,
  BillProductDescriptor,
  BillProviderPort,
  BillPurchaseInput,
  BillPurchaseResult,
  BillQueryInput,
  JsonObject,
  ListBillProductsInput,
  NormalizedProviderStatus,
} from '@twipay/contracts';

export interface MonnifyBillsConfig {
  apiKey: string;
  secretKey: string;
  baseUrl?: string;
  requestTimeoutMs?: number;
}

type UnknownRecord = Record<string, unknown>;
function record(value: unknown, name: string): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`MONNIFY_BILLS_INVALID_${name.toUpperCase()}`);
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
  return n === undefined || n < 0 ? undefined : BigInt(Math.round(n * 100));
}
function minorToMajor(amountMinor: bigint): number {
  if (amountMinor <= 0n || amountMinor > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('MONNIFY_BILLS_AMOUNT_OUT_OF_RANGE');
  return Number(amountMinor) / 100;
}
function categoryCode(category: BillCategory): string {
  if (category === 'CABLE') return 'CABLE_TV';
  return category;
}
function customerType(category: BillCategory): BillProductDescriptor['customerIdentifierType'] {
  if (category === 'ELECTRICITY') return 'METER';
  if (category === 'CABLE') return 'SMARTCARD';
  return 'PHONE';
}
function normalizeStatus(raw: unknown): NormalizedProviderStatus {
  const value = String(raw ?? '').toUpperCase();
  if (['SUCCESS', 'SUCCESSFUL', 'COMPLETED'].includes(value)) return 'SUCCEEDED';
  if (['IN_PROGRESS', 'PENDING', 'PROCESSING'].includes(value)) return 'PROCESSING';
  if (['REVERSED', 'REVERSAL'].includes(value)) return 'REVERSED';
  if (['FAILED', 'DECLINED'].includes(value)) return 'FAILED';
  return 'UNKNOWN';
}
function responseBody(body: UnknownRecord): UnknownRecord {
  return body['responseBody'] && typeof body['responseBody'] === 'object' ? record(body['responseBody'], 'response_body') : {};
}
function listFrom(value: unknown): UnknownRecord[] {
  if (Array.isArray(value)) return value.filter((entry): entry is UnknownRecord => Boolean(entry && typeof entry === 'object' && !Array.isArray(entry)));
  if (value && typeof value === 'object') {
    const r = value as UnknownRecord;
    for (const key of ['content', 'billers', 'products']) {
      if (Array.isArray(r[key])) return listFrom(r[key]);
    }
  }
  return [];
}

export class MonnifyBillsAdapter implements BillProviderPort {
  readonly code = 'monnify';
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private token?: { value: string; expiresAt: number };

  constructor(private readonly config: MonnifyBillsConfig) {
    if (!config.apiKey || !config.secretKey) throw new Error('MONNIFY_BILLS_CREDENTIALS_REQUIRED');
    this.baseUrl = (config.baseUrl ?? 'https://sandbox.monnify.com').replace(/\/$/, '');
    this.timeoutMs = config.requestTimeoutMs ?? 15_000;
  }

  createPurchaseRequestReference(merchantReference: string): string {
    return merchantReference;
  }

  async listProducts(input: ListBillProductsInput): Promise<readonly BillProductDescriptor[]> {
    const billerQuery = new URLSearchParams({ category_code: categoryCode(input.category), size: '100', page: '0' });
    const billersBody = await this.authorized('GET', `/api/v1/vas/bills-payment/billers?${billerQuery.toString()}`);
    const billers = listFrom(responseBody(billersBody));
    const products: BillProductDescriptor[] = [];
    for (const biller of billers) {
      const billerCode = text(biller['billerCode']) ?? text(biller['code']);
      if (!billerCode || (input.providerBillerCode && billerCode !== input.providerBillerCode)) continue;
      const query = new URLSearchParams({ biller_code: billerCode, size: '100', page: '0' });
      const productBody = await this.authorized('GET', `/api/v1/vas/bills-payment/biller-products?${query.toString()}`);
      for (const product of listFrom(responseBody(productBody))) {
        const productCode = text(product['productCode']) ?? text(product['code']);
        const name = text(product['productName']) ?? text(product['name']);
        if (!productCode || !name) continue;
        const fixedAmountMinor = majorToMinor(product['amount'] ?? product['price']);
        const minAmountMinor = majorToMinor(product['minimumAmount'] ?? product['minAmount']);
        const maxAmountMinor = majorToMinor(product['maximumAmount'] ?? product['maxAmount']);
        products.push({
          providerCode: this.code,
          providerProductCode: productCode,
          providerBillerCode: billerCode,
          category: input.category,
          name,
          customerIdentifierType: customerType(input.category),
          currency: 'NGN',
          ...(fixedAmountMinor !== undefined && fixedAmountMinor > 0n ? { fixedAmountMinor } : {}),
          ...(minAmountMinor !== undefined && minAmountMinor > 0n ? { minAmountMinor } : {}),
          ...(maxAmountMinor !== undefined && maxAmountMinor > 0n ? { maxAmountMinor } : {}),
          requiresCustomerValidation: true,
          metadata: {
            billerName: text(biller['billerName']) ?? text(biller['name']) ?? billerCode,
          },
        });
      }
    }
    return products;
  }

  async validateCustomer(input: BillCustomerValidationInput): Promise<BillCustomerValidationResult> {
    const body = await this.authorized('POST', '/api/v1/vas/bills-payment/validate-customer', {
      productCode: input.providerProductCode,
      customerId: input.customerIdentifier,
    });
    const data = responseBody(body);
    const vendInstruction = data['vendInstruction'] && typeof data['vendInstruction'] === 'object'
      ? record(data['vendInstruction'], 'vend_instruction')
      : data;
    const requires = vendInstruction['requireValidationRef'] === true;
    const validationReference = text(vendInstruction['validationReference']) ?? text(data['validationReference']);
    if (requires && !validationReference) throw new Error('MONNIFY_BILLS_VALIDATION_REFERENCE_MISSING');
    return {
      providerCode: this.code,
      valid: true,
      requiresValidationReference: requires,
      ...(text(data['customerName']) ? { customerName: text(data['customerName'])! } : {}),
      ...(validationReference ? { validationReference } : {}),
      rawStatus: text(body['responseCode']) ?? '0',
    };
  }

  async purchase(input: BillPurchaseInput): Promise<BillPurchaseResult> {
    if (input.currency !== 'NGN') throw new Error('MONNIFY_BILLS_SUPPORTS_NGN_ONLY');
    const body = await this.authorized('POST', '/api/v1/vas/bills-payment/vend', {
      productCode: input.providerProductCode,
      customerId: input.customerIdentifier,
      vendAmount: minorToMajor(input.amountMinor),
      vendReference: input.providerRequestReference,
      ...(input.validationReference ? { validationReference: input.validationReference } : {}),
    });
    return this.normalize(input.reference, body, input.providerRequestReference);
  }

  async queryTransaction(input: BillQueryInput): Promise<BillPurchaseResult> {
    const requestReference = input.providerRequestReference ?? input.merchantReference;
    const query = new URLSearchParams({ vendReference: requestReference });
    const body = await this.authorized('GET', `/api/v1/vas/bills-payment/requery?${query.toString()}`);
    return this.normalize(input.merchantReference, body, requestReference);
  }

  private normalize(merchantReference: string, body: UnknownRecord, expectedRequestReference: string): BillPurchaseResult {
    const data = responseBody(body);
    const rawStatus = text(data['vendStatus']) ?? text(data['status']) ?? 'UNKNOWN';
    const providerReference = text(data['transactionReference']);
    const providerRequestReference = text(data['vendReference']) ?? expectedRequestReference;
    const amountMinor = majorToMinor(data['vendAmount'] ?? data['amount']);
    const fulfillmentValue = text(data['token']) ?? text(data['purchasedCode']);
    const commissionMinor = majorToMinor(data['cashbackAmount'] ?? data['commission']);
    return {
      providerCode: this.code,
      merchantReference,
      ...(providerReference ? { providerReference } : {}),
      providerRequestReference,
      status: normalizeStatus(rawStatus),
      ...(amountMinor !== undefined ? { amountMinor } : {}),
      currency: 'NGN',
      ...(fulfillmentValue ? { fulfillmentValue } : {}),
      ...(commissionMinor !== undefined ? { commissionMinor } : {}),
      rawStatus,
    };
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 300_000) return this.token.value;
    const credentials = Buffer.from(`${this.config.apiKey}:${this.config.secretKey}`).toString('base64');
    const response = await fetch(`${this.baseUrl}/api/v1/auth/login`, {
      method: 'POST', headers: { Authorization: `Basic ${credentials}`, Accept: 'application/json' }, signal: AbortSignal.timeout(this.timeoutMs),
    });
    const body = record(await response.json(), 'auth_response');
    if (!response.ok || body['requestSuccessful'] === false) throw new Error(`MONNIFY_BILLS_AUTH_HTTP_${response.status}`);
    const data = responseBody(body);
    const token = text(data['accessToken']);
    if (!token) throw new Error('MONNIFY_BILLS_ACCESS_TOKEN_MISSING');
    const expiresIn = num(data['expiresIn']) ?? 3600;
    this.token = { value: token, expiresAt: Date.now() + expiresIn * 1000 };
    return token;
  }

  private async authorized(method: 'GET' | 'POST', path: string, payload?: Record<string, unknown>): Promise<UnknownRecord> {
    const token = await this.accessToken();
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(payload ? { 'Content-Type': 'application/json' } : {}) },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const body = record(await response.json(), 'response');
    if (!response.ok || body['requestSuccessful'] === false) throw new Error(`MONNIFY_BILLS_HTTP_${response.status}`);
    return body;
  }
}
