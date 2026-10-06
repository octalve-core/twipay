export type CurrencyCode = 'NGN' | 'USD' | 'GBP' | 'EUR';
export type MinorAmount = Readonly<{ amountMinor: bigint; currency: CurrencyCode }>;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export type AuthMethod = 'password' | 'google' | 'passkey';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';

export interface SessionPrincipal {
  userId: string;
  sessionId: string;
  roles: readonly string[];
  authMethods: readonly AuthMethod[];
  mfaSatisfied: boolean;
}

export type NormalizedProviderStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'REQUIRES_ACTION'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REVERSED'
  | 'UNKNOWN';

export type PaymentRail =
  | 'CARD'
  | 'BANK_TRANSFER'
  | 'VIRTUAL_ACCOUNT'
  | 'USSD'
  | 'MOBILE_MONEY'
  | 'STABLECOIN';

export interface ProviderCustomerIdentity {
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  phoneE164?: string;
}

export interface CreateCollectionInput {
  reference: string;
  amountMinor: bigint;
  currency: CurrencyCode;
  customer: ProviderCustomerIdentity;
  callbackUrl?: string;
  rails?: readonly PaymentRail[];
  metadata?: JsonObject;
}

export interface CollectionResult {
  providerCode: string;
  providerReference: string;
  merchantReference: string;
  status: NormalizedProviderStatus;
  amountMinor?: bigint;
  currency?: CurrencyCode;
  checkoutUrl?: string;
  rail?: PaymentRail;
  rawStatus?: string;
}

export interface GetCollectionInput {
  merchantReference: string;
  providerReference?: string;
}

export interface CreateVirtualAccountInput {
  reference: string;
  currency: CurrencyCode;
  customer: ProviderCustomerIdentity;
  preferredBank?: string;
  consentRecordedAt: string;
  identity?: {
    bvn?: string;
    nin?: string;
    bankAccountNumber?: string;
    bankCode?: string;
  };
}

export interface VirtualAccountResult {
  providerCode: string;
  providerAccountId?: string;
  reference: string;
  accountNumber?: string;
  accountName?: string;
  bankCode?: string;
  bankName?: string;
  currency: CurrencyCode;
  status: 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'FAILED';
}


export interface ResolveBankAccountInput {
  bankCode: string;
  accountNumber: string;
  currency: CurrencyCode;
}

export interface ResolvedBankAccount {
  providerCode: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  bankName?: string;
  currency: CurrencyCode;
}

export interface CreatePayoutInput {
  reference: string;
  amountMinor: bigint;
  currency: CurrencyCode;
  narration: string;
  beneficiary: {
    bankCode: string;
    accountNumber: string;
    accountName: string;
  };
  sender?: {
    name?: string;
    accountNumber?: string;
    bankCode?: string;
  };
}

export interface PayoutResult {
  providerCode: string;
  providerReference?: string;
  merchantReference: string;
  status: NormalizedProviderStatus;
  amountMinor?: bigint;
  currency?: CurrencyCode;
  feeMinor?: bigint;
  rawStatus?: string;
  requiresAuthorization?: boolean;
}

export interface GetPayoutInput {
  merchantReference: string;
  providerReference?: string;
}

export interface RawWebhookRequest {
  rawBody: Uint8Array;
  headers: Readonly<Record<string, string | string[] | undefined>>;
  sourceIp?: string;
}

export interface VirtualAccountAssignmentEvent {
  status: 'ACTIVE' | 'FAILED';
  customerEmail?: string;
  providerAccountId?: string;
  accountNumber?: string;
  accountName?: string;
  bankCode?: string;
  bankName?: string;
  currency?: CurrencyCode;
}

export interface VirtualAccountCreditEvent {
  /** Reference accepted by the provider's server-side collection verification endpoint. */
  collectionReference: string;
  /** Provider transaction identifier when distinct from collectionReference. */
  providerReference?: string;
  accountReference?: string;
  accountNumber?: string;
  amountMinor?: bigint;
  currency?: CurrencyCode;
}

export interface VerifiedWebhook {
  providerCode: string;
  eventType: string;
  externalEventId?: string;
  merchantReference?: string;
  providerReference?: string;
  status?: NormalizedProviderStatus;
  payloadHash: string;
  normalizedPayload: JsonObject;
  virtualAccountAssignment?: VirtualAccountAssignmentEvent;
  virtualAccountCredit?: VirtualAccountCreditEvent;
}

export interface PaymentProviderPort {
  readonly code: string;
  createCollection(input: CreateCollectionInput): Promise<CollectionResult>;
  getCollection(input: GetCollectionInput): Promise<CollectionResult>;
  createVirtualAccount(input: CreateVirtualAccountInput): Promise<VirtualAccountResult>;
  resolveBankAccount(input: ResolveBankAccountInput): Promise<ResolvedBankAccount>;
  createPayout(input: CreatePayoutInput): Promise<PayoutResult>;
  getPayout(input: GetPayoutInput): Promise<PayoutResult>;
  verifyWebhook(input: RawWebhookRequest): Promise<VerifiedWebhook>;
}

export interface BillProviderPort {
  readonly code: string;
  getProducts(input: JsonObject): Promise<JsonObject>;
  validateCustomer(input: JsonObject): Promise<JsonObject>;
  purchase(input: JsonObject): Promise<JsonObject>;
  queryTransaction(providerReference: string): Promise<JsonObject>;
}

export type IdentityCheckType = 'BVN' | 'NIN' | 'BANK_ACCOUNT' | 'CAC';
export type IdentityCheckStatus = 'CREATED' | 'AWAITING_CONSENT' | 'PENDING' | 'VERIFIED' | 'FAILED' | 'EXPIRED';

export interface InitiateIdentityCheckInput {
  reference: string;
  type: IdentityCheckType;
  identifier: string;
  scope?: 'identity' | 'bank_accounts';
}

export interface ContinueIdentityCheckInput {
  providerReference: string;
  action: 'REQUEST_OTP' | 'SUBMIT_OTP';
  verificationMethod?: string;
  phoneNumber?: string;
  otp?: string;
}

export interface IdentityCheckResult {
  providerCode: string;
  providerReference?: string;
  merchantReference: string;
  status: IdentityCheckStatus;
  matched?: boolean;
  attributes?: JsonObject;
  rawStatus?: string;
}

export interface IdentityVerificationProviderPort {
  readonly code: string;
  initiateIdentityCheck(input: InitiateIdentityCheckInput): Promise<IdentityCheckResult>;
  continueIdentityCheck(input: ContinueIdentityCheckInput): Promise<IdentityCheckResult>;
}

export interface NotificationProviderPort {
  readonly code: string;
  send(input: JsonObject): Promise<JsonObject>;
}
