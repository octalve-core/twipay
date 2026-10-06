export type CurrencyCode = 'NGN' | 'USD' | 'GBP' | 'EUR';
export type MinorAmount = Readonly<{ amountMinor: bigint; currency: CurrencyCode }>;

export type AuthMethod = 'password' | 'google' | 'passkey';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';

export interface SessionPrincipal {
  userId: string;
  sessionId: string;
  roles: readonly string[];
  authMethods: readonly AuthMethod[];
  mfaSatisfied: boolean;
}

export interface PaymentProviderPort {
  readonly code: string;
  createCollection(input: unknown): Promise<unknown>;
  getCollection(providerReference: string): Promise<unknown>;
  verifyWebhook(input: unknown): Promise<unknown>;
}

export interface BillProviderPort {
  readonly code: string;
  getProducts(input: unknown): Promise<unknown>;
  validateCustomer(input: unknown): Promise<unknown>;
  purchase(input: unknown): Promise<unknown>;
  queryTransaction(providerReference: string): Promise<unknown>;
}

export interface IdentityVerificationProviderPort {
  readonly code: string;
  initiateIdentityCheck(input: unknown): Promise<unknown>;
  completeIdentityCheck(input: unknown): Promise<unknown>;
}

export interface NotificationProviderPort {
  readonly code: string;
  send(input: unknown): Promise<unknown>;
}
