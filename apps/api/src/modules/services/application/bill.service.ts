import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { BillPurchaseResult, JsonObject, NormalizedProviderStatus } from '@twipay/contracts';
import { assertBillAmount, assertBillPurchaseTransition } from '@twipay/services';
import { decryptSensitiveString, encryptSensitiveString, fingerprintSensitiveValue } from '@twipay/security';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { FinancialAuthorizationService, type FinancialAuthorization } from '../../finance/application/financial-authorization.service.js';
import { BillProviderRegistry, type EnabledBillProvider } from '../../providers/bill-provider.registry.js';
import { FinancialTransactionService } from '../../finance/application/financial-transaction.service.js';
import { IdempotencyService } from '../../finance/application/idempotency.service.js';
import { LedgerService } from '../../finance/application/ledger.service.js';
import { createFinancialReference } from '../../finance/application/reference.js';
import { WalletService } from '../../finance/application/wallet.service.js';
import { BillProviderRouterService } from './provider-router.service.js';
import { billPricingDigest, issueBillQuote, verifyBillQuote } from './bill-quote.js';

function normalizeIdentifier(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 3 || normalized.length > 64) throw new BadRequestException({ code: 'INVALID_CUSTOMER_IDENTIFIER' });
  return normalized;
}

function validationTtlMinutes(): number {
  const value = Number(process.env['BILL_VALIDATION_TTL_MINUTES'] ?? '15');
  if (!Number.isInteger(value) || value < 1 || value > 120) throw new Error('INVALID_BILL_VALIDATION_TTL_MINUTES');
  return value;
}


function reconcilePolicy(): { maxAttempts: number; baseDelayMs: number; maxDelayMs: number } {
  const maxAttempts = Number(process.env['BILL_RECONCILE_MAX_ATTEMPTS'] ?? '12');
  const baseDelayMs = Number(process.env['BILL_RECONCILE_BASE_DELAY_MS'] ?? '30000');
  const maxDelayMs = Number(process.env['BILL_RECONCILE_MAX_DELAY_MS'] ?? '900000');
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 100) throw new Error('INVALID_BILL_RECONCILE_MAX_ATTEMPTS');
  if (!Number.isInteger(baseDelayMs) || baseDelayMs < 5000 || baseDelayMs > 300000) throw new Error('INVALID_BILL_RECONCILE_BASE_DELAY_MS');
  if (!Number.isInteger(maxDelayMs) || maxDelayMs < baseDelayMs || maxDelayMs > 3600000) throw new Error('INVALID_BILL_RECONCILE_MAX_DELAY_MS');
  return { maxAttempts, baseDelayMs, maxDelayMs };
}
function nextReconcileAt(attempt: number): Date {
  const policy = reconcilePolicy();
  const exponent = Math.min(Math.max(attempt - 1, 0), 10);
  return new Date(Date.now() + Math.min(policy.baseDelayMs * 2 ** exponent, policy.maxDelayMs));
}

function operationStatus(status: NormalizedProviderStatus): 'PENDING' | 'PROCESSING' | 'REQUIRES_ACTION' | 'SUCCEEDED' | 'FAILED' | 'REVERSED' | 'UNKNOWN' {
  return status;
}

@Injectable()
export class BillService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: FinancialAuthorizationService,
    private readonly providers: BillProviderRegistry,
    private readonly router: BillProviderRouterService,
    private readonly idempotency: IdempotencyService,
    private readonly financial: FinancialTransactionService,
    private readonly wallets: WalletService,
    private readonly ledger: LedgerService,
  ) {}

  async validateCustomer(input: { userId: string; productCode: string; customerIdentifier: string }) {
    const product = await this.prisma.billProduct.findUnique({ where: { code: input.productCode } });
    if (!product || product.status !== 'ACTIVE') throw new NotFoundException({ code: 'BILL_PRODUCT_NOT_FOUND' });
    const route = await this.router.resolve(product.id);
    const offer = await this.prisma.billProviderOffer.findUniqueOrThrow({ where: { id: route.offerId } });
    const identifier = normalizeIdentifier(input.customerIdentifier);
    const fingerprint = fingerprintSensitiveValue(identifier, process.env['PII_FINGERPRINT_KEY']!);
    const now = new Date();
    const existing = await this.prisma.billCustomerValidation.findFirst({
      where: { userId: input.userId, providerOfferId: offer.id, customerIdentifierFingerprint: fingerprint, valid: true, expiresAt: { gt: now } },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return { id: existing.id, valid: true, customerName: existing.customerName, providerCode: offer.providerCode, expiresAt: existing.expiresAt };

    if (!offer.requiresValidation) {
      const expiresAt = new Date(now.getTime() + validationTtlMinutes() * 60_000);
      const row = await this.prisma.billCustomerValidation.create({
        data: {
          userId: input.userId,
          providerOfferId: offer.id,
          providerCode: offer.providerCode,
          providerProductCode: offer.providerProductCode,
          customerIdentifierFingerprint: fingerprint,
          customerIdentifierCiphertext: encryptSensitiveString(identifier, process.env['DATA_ENCRYPTION_KEY']!),
          customerIdentifierLast4: identifier.slice(-4),
          valid: true,
          expiresAt,
        },
      });
      return { id: row.id, valid: true, customerName: null, providerCode: offer.providerCode, expiresAt };
    }

    const started = Date.now();
    let result;
    try {
      result = await this.providers.get(route.providerCode).validateCustomer({
        category: product.category,
        providerProductCode: offer.providerProductCode,
        providerBillerCode: offer.providerBillerCode,
        customerIdentifier: identifier,
      });
    } catch (error) {
      await this.router.recordOutcome({ providerCode: route.providerCode, category: product.category, outcome: 'TRANSIENT_FAILURE', latencyMs: Date.now() - started });
      throw error;
    }
    await this.router.recordOutcome({
      providerCode: route.providerCode,
      category: product.category,
      outcome: result.valid ? 'SUCCESS' : 'DETERMINISTIC_FAILURE',
      latencyMs: Date.now() - started,
    });
    const expiresAt = new Date(now.getTime() + validationTtlMinutes() * 60_000);
    const row = await this.prisma.billCustomerValidation.create({
      data: {
        userId: input.userId,
        providerOfferId: offer.id,
        providerCode: offer.providerCode,
        providerProductCode: offer.providerProductCode,
        customerIdentifierFingerprint: fingerprint,
        customerIdentifierCiphertext: encryptSensitiveString(identifier, process.env['DATA_ENCRYPTION_KEY']!),
        customerIdentifierLast4: identifier.slice(-4),
        customerName: result.customerName ?? null,
        validationReferenceCiphertext: result.validationReference
          ? encryptSensitiveString(result.validationReference, process.env['DATA_ENCRYPTION_KEY']!)
          : null,
        valid: result.valid,
        expiresAt,
      },
    });
    return { id: row.id, valid: row.valid, customerName: row.customerName, providerCode: offer.providerCode, expiresAt };
  }

  /** Quote only the currently active, validated provider offer and approved pricing. */
  async quotePurchase(input: { userId: string; productCode: string; customerIdentifier: string;
    amountMinor: bigint; validationId: string }) {
    const product = await this.prisma.billProduct.findUnique({ where: { code: input.productCode } });
    if (!product || product.status !== 'ACTIVE' || product.currency !== 'NGN') throw new NotFoundException({ code: 'BILL_PRODUCT_NOT_FOUND' });
    assertBillAmount({ amountMinor: input.amountMinor,
      ...(product.fixedAmountMinor !== null ? { fixedAmountMinor: product.fixedAmountMinor } : {}),
      ...(product.minAmountMinor !== null ? { minAmountMinor: product.minAmountMinor } : {}),
      ...(product.maxAmountMinor !== null ? { maxAmountMinor: product.maxAmountMinor } : {}),
    });
    const route = await this.router.resolve(product.id);
    const identifierFingerprint = fingerprintSensitiveValue(normalizeIdentifier(input.customerIdentifier), process.env['PII_FINGERPRINT_KEY']!);
    const validation = await this.prisma.billCustomerValidation.findFirst({
      where: { id: input.validationId, userId: input.userId, providerOfferId: route.offerId,
        customerIdentifierFingerprint: identifierFingerprint, valid: true, expiresAt: { gt: new Date() } },
    });
    if (!validation) throw new ConflictException({ code: 'BILL_VALIDATION_EXPIRED_RESTART' });
    const { token, terms } = issueBillQuote({
      userId: input.userId, productCode: product.code, productId: product.id, offerId: route.offerId,
      identifierFingerprint, validationId: input.validationId, pricingDigest: billPricingDigest(product), amountMinor: input.amountMinor,
    });
    return { quoteToken: token, quoteId: terms.id, expiresAt: new Date(terms.expiresAt).toISOString(),
      amountMinor: terms.amountMinor, feeMinor: terms.feeMinor, totalDebitMinor: terms.totalDebitMinor,
      currency: 'NGN' as const, productCode: product.code, provider: validation.providerCode };
  }

  async totalDebitForQuote(input: { userId: string; token: string; productCode: string;
    customerIdentifier: string; validationId: string; amountMinor: bigint }): Promise<bigint> {
    const product = await this.prisma.billProduct.findUnique({ where: { code: input.productCode } });
    if (!product || product.status !== 'ACTIVE' || product.currency !== 'NGN') throw new NotFoundException({ code: 'BILL_PRODUCT_NOT_FOUND' });
    const route = await this.router.resolve(product.id);
    const terms = verifyBillQuote({ token: input.token, userId: input.userId, productCode: input.productCode,
      productId: product.id, offerId: route.offerId, identifierFingerprint: fingerprintSensitiveValue(normalizeIdentifier(input.customerIdentifier), process.env['PII_FINGERPRINT_KEY']!),
      validationId: input.validationId, pricingDigest: billPricingDigest(product), amountMinor: input.amountMinor });
    return BigInt(terms.totalDebitMinor);
  }

  async purchase(input: {
    authorization: FinancialAuthorization;
    userId: string;
    idempotencyKey: string;
    productCode: string;
    customerIdentifier: string;
    amountMinor: bigint;
    validationId: string;
    quoteToken: string;
    contactPhoneE164?: string;
  }): Promise<{ statusCode: number; body: JsonObject }> {
    const normalizedIdentifier = normalizeIdentifier(input.customerIdentifier);
    // Verify before any idempotency creation or provider side effect.
    const productForQuote = await this.prisma.billProduct.findUnique({ where: { code: input.productCode } });
    if (!productForQuote || productForQuote.status !== 'ACTIVE' || productForQuote.currency !== 'NGN') throw new NotFoundException({ code: 'BILL_PRODUCT_NOT_FOUND' });
    const initialRoute = await this.router.resolve(productForQuote.id);
    const identifierFingerprintForQuote = fingerprintSensitiveValue(normalizedIdentifier, process.env['PII_FINGERPRINT_KEY']!);
    const quote = verifyBillQuote({ token: input.quoteToken, userId: input.userId, productCode: input.productCode,
      productId: productForQuote.id, offerId: initialRoute.offerId, identifierFingerprint: identifierFingerprintForQuote,
      validationId: input.validationId, pricingDigest: billPricingDigest(productForQuote), amountMinor: input.amountMinor });
    if (input.authorization.amountMinor !== BigInt(quote.totalDebitMinor)) throw new ConflictException({ code: 'BILL_AUTHORIZED_TOTAL_CHANGED' });
    const idem = await this.idempotency.begin({ scope: 'bill:purchase', key: input.idempotencyKey, userId: input.userId, request: { userId: input.userId, productCode: input.productCode, customerIdentifier: input.customerIdentifier, amountMinor: input.amountMinor, validationId: input.validationId, quoteId: quote.id, contactPhoneE164: input.contactPhoneE164 } });
    if (idem.replay) return { statusCode: idem.replay.status, body: idem.replay.body };
    const idemId = idem.recordId!;
    let submittedContext: { purchaseId: string; financialId: string; operationId: string; reference: string } | undefined;

    try {
      const product = await this.prisma.billProduct.findUnique({ where: { code: input.productCode } });
      if (!product || product.status !== 'ACTIVE') throw new NotFoundException({ code: 'BILL_PRODUCT_NOT_FOUND' });
      if (product.currency !== 'NGN') throw new BadRequestException({ code: 'BILL_PRODUCT_CURRENCY_UNSUPPORTED' });
      assertBillAmount({
        amountMinor: input.amountMinor,
        ...(product.fixedAmountMinor !== null ? { fixedAmountMinor: product.fixedAmountMinor } : {}),
        ...(product.minAmountMinor !== null ? { minAmountMinor: product.minAmountMinor } : {}),
        ...(product.maxAmountMinor !== null ? { maxAmountMinor: product.maxAmountMinor } : {}),
      });

      const route = await this.router.resolve(product.id);
      if (route.offerId !== quote.offerId || product.id !== quote.productId
          || billPricingDigest(product) !== quote.pricingDigest) throw new ConflictException({ code: 'BILL_PRICING_OR_ROUTE_CHANGED' });
      const offer = await this.prisma.billProviderOffer.findUniqueOrThrow({ where: { id: route.offerId } });
      const identifierFingerprint = fingerprintSensitiveValue(normalizedIdentifier, process.env['PII_FINGERPRINT_KEY']!);
      // The quote always binds the owner, provider offer and recently verified recipient.
      const approvedValidation = await this.prisma.billCustomerValidation.findFirst({
        where: { id: input.validationId, userId: input.userId, providerOfferId: offer.id,
          customerIdentifierFingerprint: identifierFingerprint, valid: true, expiresAt: { gt: new Date() } },
      });
      if (!approvedValidation) throw new ConflictException({ code: 'BILL_VALIDATION_EXPIRED_RESTART' });
      let validationReference: string | undefined;
      if (offer.requiresValidation) {
        let validation = input.validationId
          ? await this.prisma.billCustomerValidation.findFirst({
              where: { id: input.validationId, userId: input.userId, providerOfferId: offer.id, customerIdentifierFingerprint: identifierFingerprint, valid: true, expiresAt: { gt: new Date() } },
            })
          : null;
        if (!validation) {
          const validationResult = await this.validateCustomer({ userId: input.userId, productCode: input.productCode, customerIdentifier: normalizedIdentifier });
          if (!validationResult.valid) throw new BadRequestException({ code: 'BILL_CUSTOMER_VALIDATION_FAILED' });
          validation = await this.prisma.billCustomerValidation.findUniqueOrThrow({ where: { id: validationResult.id } });
          if (validation.providerOfferId !== offer.id) {
            // Provider routing changed between validation and purchase. We do not
            // reuse provider-specific validation evidence across providers.
            throw new ConflictException({ code: 'BILL_ROUTE_CHANGED_REVALIDATE' });
          }
        }
        if (validation.validationReferenceCiphertext) {
          validationReference = decryptSensitiveString(validation.validationReferenceCiphertext, process.env['DATA_ENCRYPTION_KEY']!);
        }
      }

      const reference = createFinancialReference('bill');
      const provider = this.providers.get(route.providerCode);
      const providerRequestReference = provider.createPurchaseRequestReference(reference).trim();
      if (!providerRequestReference || providerRequestReference.length > 160) {
        throw new Error('BILL_PROVIDER_REQUEST_REFERENCE_INVALID');
      }
      const created = await this.prisma.$transaction(async (tx) => {
        const currentProduct = await tx.billProduct.findUniqueOrThrow({ where: { id: product.id } });
        const currentOffer = await tx.billProviderOffer.findUniqueOrThrow({ where: { id: offer.id } });
        if (!currentOffer.active || currentProduct.status !== 'ACTIVE' || currentProduct.currency !== 'NGN') throw new ConflictException({ code: 'BILL_PRICING_OR_ROUTE_CHANGED' });
        const fresh = verifyBillQuote({ token: input.quoteToken, userId: input.userId, productCode: input.productCode,
          productId: currentProduct.id, offerId: currentOffer.id, identifierFingerprint,
          validationId: input.validationId, pricingDigest: billPricingDigest(currentProduct), amountMinor: input.amountMinor });
        if (fresh.id !== quote.id) throw new ConflictException({ code: 'BILL_QUOTE_CHANGED' });
        const validNow = await tx.billCustomerValidation.findFirst({ where: { id: input.validationId,
          userId: input.userId, providerOfferId: offer.id, customerIdentifierFingerprint: identifierFingerprint,
          valid: true, expiresAt: { gt: new Date() } } });
        if (!validNow) throw new ConflictException({ code: 'BILL_VALIDATION_EXPIRED_RESTART' });
        await this.authorization.assertCurrentWithTx(tx, input.authorization, BigInt(fresh.totalDebitMinor), { userId: input.userId, intent: 'BILL_PAYMENT' });
        const wallet = await this.wallets.ensureUserWalletWithTx(tx, input.userId, 'NGN');
        const financial = await this.financial.createWithTx(tx, {
          reference,
          userId: input.userId,
          type: 'BILL_PAYMENT',
          currency: 'NGN',
          amountMinor: input.amountMinor,
          description: `${product.category} purchase`,
        });
        await this.financial.transitionWithTx(tx, financial.id, 'AUTHORIZED', 'BILL_PURCHASE_AUTHORIZED');
        const purchase = await tx.billPurchase.create({
          data: {
            userId: input.userId,
            financialTransactionId: financial.id,
            productId: product.id,
            providerOfferId: offer.id,
            customerIdentifierCiphertext: encryptSensitiveString(normalizedIdentifier, process.env['DATA_ENCRYPTION_KEY']!),
            customerIdentifierFingerprint: identifierFingerprint,
            customerIdentifierLast4: normalizedIdentifier.slice(-4),
            contactPhoneCiphertext: input.contactPhoneE164
              ? encryptSensitiveString(input.contactPhoneE164, process.env['DATA_ENCRYPTION_KEY']!)
              : null,
            amountMinor: input.amountMinor,
            currency: 'NGN',
            providerRequestReference,
            approvalQuoteId: quote.id,
          },
        });
        assertBillPurchaseTransition('CREATED', 'VALIDATED');
        await tx.billPurchase.update({ where: { id: purchase.id }, data: { status: 'VALIDATED' } });
        const hold = await this.wallets.reserveWithTx(tx, {
          userId: input.userId,
          walletId: wallet.id,
          financialTransactionId: financial.id,
          amountMinor: input.amountMinor,
        });
        await this.financial.transitionWithTx(tx, financial.id, 'FUNDS_RESERVED', 'BILL_FUNDS_RESERVED');
        assertBillPurchaseTransition('VALIDATED', 'FUNDS_RESERVED');
        await tx.billPurchase.update({ where: { id: purchase.id }, data: { status: 'FUNDS_RESERVED' } });
        const operation = await tx.providerOperation.create({
          data: {
            financialTransactionId: financial.id,
            userId: input.userId,
            type: 'BILL_PURCHASE',
            providerCode: route.providerCode,
            merchantReference: reference,
            status: 'PENDING',
          },
        });
        return { wallet, financial, purchase, hold, operation };
      });
      await this.idempotency.attachResource(idemId, 'bill_purchase', created.purchase.id);
      submittedContext = { purchaseId: created.purchase.id, financialId: created.financial.id, operationId: created.operation.id, reference };

      // Mark submission before the network call. A crash after this point is
      // reconciled against the same provider; it is never automatically routed
      // to a second provider because the first provider may already have vended.
      await this.prisma.$transaction(async (tx) => {
        await this.financial.moveToProviderSubmittedWithTx(tx, created.financial.id);
        assertBillPurchaseTransition('FUNDS_RESERVED', 'PROVIDER_SUBMITTED');
        await tx.billPurchase.update({ where: { id: created.purchase.id }, data: { status: 'PROVIDER_SUBMITTED', attempts: { increment: 1 } } });
        await tx.providerOperation.update({ where: { id: created.operation.id }, data: { status: 'PROCESSING' } });
      });

      const started = Date.now();
      let providerResult: BillPurchaseResult;
      try {
        providerResult = await provider.purchase({
          reference,
          providerRequestReference,
          category: product.category,
          providerProductCode: offer.providerProductCode,
          providerBillerCode: offer.providerBillerCode,
          customerIdentifier: normalizedIdentifier,
          ...(input.contactPhoneE164 ? { contactPhoneE164: input.contactPhoneE164 } : {}),
          amountMinor: input.amountMinor,
          currency: 'NGN',
          ...(validationReference ? { validationReference } : {}),
        });
      } catch (error) {
        await this.router.recordOutcome({ providerCode: route.providerCode, category: product.category, outcome: 'TRANSIENT_FAILURE', latencyMs: Date.now() - started });
        await this.markUnknown(created.purchase.id, created.financial.id, created.operation.id, 'PROVIDER_CALL_OUTCOME_UNKNOWN');
        const body: JsonObject = { reference, status: 'UNKNOWN', code: 'PROVIDER_OUTCOME_UNKNOWN' };
        await this.idempotency.complete(idemId, 202, body);
        return { statusCode: 202, body };
      }

      const applied = await this.applyProviderResult({
          purchaseId: created.purchase.id,
          financialTransactionId: created.financial.id,
          providerOperationId: created.operation.id,
          holdId: created.hold.id,
          walletLedgerAccountId: created.wallet.ledgerAccountId,
          providerCode: route.providerCode,
          category: product.category,
          result: providerResult,
        });
      await this.router.recordOutcome({
        providerCode: route.providerCode,
        category: product.category,
        outcome: providerResult.status === 'FAILED' ? 'DETERMINISTIC_FAILURE' : providerResult.status === 'UNKNOWN' ? 'TRANSIENT_FAILURE' : 'SUCCESS',
        latencyMs: Date.now() - started,
      });
      const body = await this.purchaseResponse(created.purchase.id);
      await this.idempotency.complete(idemId, applied === 'UNKNOWN' ? 202 : providerResult.status === 'FAILED' ? 409 : 201, body);
      return { statusCode: applied === 'UNKNOWN' ? 202 : providerResult.status === 'FAILED' ? 409 : 201, body };
    } catch (error) {
      if (submittedContext) {
        await this.markUnknown(submittedContext.purchaseId, submittedContext.financialId, submittedContext.operationId, 'POST_SUBMISSION_INTERNAL_ERROR');
        const body: JsonObject = { reference: submittedContext.reference, status: 'UNKNOWN', code: 'TRANSACTION_REQUIRES_RECONCILIATION' };
        await this.idempotency.complete(idemId, 202, body);
        return { statusCode: 202, body };
      }
      const body: JsonObject = { code: error instanceof Error ? error.name : 'BILL_PURCHASE_REJECTED' };
      await this.idempotency.fail(idemId, 409, body);
      throw error;
    }
  }

  async reconcile(reference: string): Promise<void> {
    const purchase = await this.prisma.billPurchase.findFirst({
      where: { financialTransaction: { reference } },
      include: { financialTransaction: { include: { holds: true } }, providerOffer: true, product: true },
    });
    if (!purchase) throw new NotFoundException({ code: 'BILL_PURCHASE_NOT_FOUND' });
    if (!['PROCESSING', 'UNKNOWN', 'PROVIDER_SUBMITTED'].includes(purchase.status)) return;
    const operation = await this.prisma.providerOperation.findFirstOrThrow({ where: { financialTransactionId: purchase.financialTransactionId, type: 'BILL_PURCHASE' } });
    if (operation.providerCode !== 'vtpass' && operation.providerCode !== 'monnify') throw new Error('BILL_PROVIDER_NOT_ENABLED');
    const hold = purchase.financialTransaction.holds.find((item) => item.status === 'ACTIVE') ?? purchase.financialTransaction.holds[0];
    if (!hold) throw new Error('BILL_PURCHASE_HOLD_NOT_FOUND');
    const wallet = await this.prisma.wallet.findUniqueOrThrow({ where: { id: hold.walletId } });
    const started = Date.now();
    let result: BillPurchaseResult;
    try {
      result = await this.providers.get(operation.providerCode).queryTransaction({
        merchantReference: operation.merchantReference,
        ...(purchase.providerRequestReference ? { providerRequestReference: purchase.providerRequestReference } : {}),
        ...(operation.providerReference ? { providerReference: operation.providerReference } : {}),
      });
    } catch (error) {
      await this.deferReconcileAfterQueryFailure(purchase.id, purchase.financialTransactionId, operation.id);
      await this.router.recordOutcome({ providerCode: operation.providerCode, category: purchase.product.category, outcome: 'TRANSIENT_FAILURE', latencyMs: Date.now() - started });
      throw error;
    }
    await this.applyProviderResult({
      purchaseId: purchase.id,
      financialTransactionId: purchase.financialTransactionId,
      providerOperationId: operation.id,
      holdId: hold.id,
      walletLedgerAccountId: wallet.ledgerAccountId,
      providerCode: operation.providerCode,
      category: purchase.product.category,
      result,
    });
    await this.router.recordOutcome({
      providerCode: operation.providerCode, category: purchase.product.category,
      outcome: result.status === 'FAILED' ? 'DETERMINISTIC_FAILURE' : result.status === 'UNKNOWN' ? 'TRANSIENT_FAILURE' : 'SUCCESS',
      latencyMs: Date.now() - started,
    });
  }

  async reconcileDue(limit = 25): Promise<number> {
    const rows = await this.prisma.billPurchase.findMany({
      where: {
        status: { in: ['PROVIDER_SUBMITTED', 'PROCESSING', 'UNKNOWN'] },
        reconcileAttempts: { lt: reconcilePolicy().maxAttempts },
        OR: [{ nextReconcileAt: null }, { nextReconcileAt: { lte: new Date() } }],
      },
      orderBy: { updatedAt: 'asc' },
      take: Math.min(Math.max(limit, 1), 100),
      select: { financialTransaction: { select: { reference: true } } },
    });
    for (const row of rows) {
      try { await this.reconcile(row.financialTransaction.reference); } catch { /* retained for the next bounded sweep */ }
    }
    return rows.length;
  }


  async listForUser(userId: string): Promise<JsonObject[]> {
    const purchases = await this.prisma.billPurchase.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, take: 100,
      include: { financialTransaction: true, product: true, providerOffer: true },
    });
    return purchases.map((purchase) => this.serializePurchase(purchase));
  }

  async getForUser(userId: string, reference: string): Promise<JsonObject | null> {
    const purchase = await this.prisma.billPurchase.findFirst({
      where: { userId, financialTransaction: { reference } },
      include: { financialTransaction: true, product: true, providerOffer: true },
    });
    if (!purchase) return null;
    return this.serializePurchase(purchase);
  }

  private async purchaseResponse(purchaseId: string): Promise<JsonObject> {
    const purchase = await this.prisma.billPurchase.findUniqueOrThrow({
      where: { id: purchaseId },
      include: { financialTransaction: true, product: true, providerOffer: true },
    });
    return this.serializePurchase(purchase);
  }

  private serializePurchase(purchase: {
    status: string; amountMinor: bigint; currency: string; fulfillmentCiphertext: string | null;
    financialTransaction: { reference: string }; product: { code: string; category: string; name: string };
    providerOffer: { providerCode: string };
  }): JsonObject {
    return {
      reference: purchase.financialTransaction.reference,
      status: purchase.status,
      productCode: purchase.product.code,
      category: purchase.product.category,
      productName: purchase.product.name,
      amountMinor: purchase.amountMinor.toString(),
      currency: purchase.currency,
      provider: purchase.providerOffer.providerCode,
      ...(purchase.fulfillmentCiphertext
        ? { fulfillment: decryptSensitiveString(purchase.fulfillmentCiphertext, process.env['DATA_ENCRYPTION_KEY']!) }
        : {}),
    };
  }

  private async transitionPurchaseWithTx(tx: Prisma.TransactionClient, purchaseId: string, to: Parameters<typeof assertBillPurchaseTransition>[1]) {
    const current = await tx.billPurchase.findUniqueOrThrow({ where: { id: purchaseId } });
    if (current.status === to) return current;
    assertBillPurchaseTransition(current.status, to);
    return tx.billPurchase.update({ where: { id: purchaseId }, data: { status: to } });
  }

  private async markUnknown(purchaseId: string, financialId: string, operationId: string, reason: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "financial_transactions" WHERE "id" = ${financialId}::uuid FOR UPDATE`;
      const purchase = await tx.billPurchase.findUniqueOrThrow({ where: { id: purchaseId } });
      if (!['SUCCEEDED', 'FAILED', 'REVERSED', 'CANCELLED'].includes(purchase.status)) {
        if (purchase.status === 'FUNDS_RESERVED') await this.transitionPurchaseWithTx(tx, purchaseId, 'PROVIDER_SUBMITTED');
        const afterSubmit = await tx.billPurchase.findUniqueOrThrow({ where: { id: purchaseId } });
        if (afterSubmit.status !== 'UNKNOWN') await this.transitionPurchaseWithTx(tx, purchaseId, 'UNKNOWN');
        const attempt = purchase.reconcileAttempts + 1;
        const exhausted = attempt >= reconcilePolicy().maxAttempts;
        await tx.billPurchase.update({
          where: { id: purchaseId },
          data: { reconcileAttempts: attempt, nextReconcileAt: exhausted ? null : nextReconcileAt(attempt) },
        });
        await this.ensureReconciliationCaseWithTx(tx, {
          type: 'PROVIDER_STATUS_MISMATCH',
          status: exhausted ? 'NEEDS_REVIEW' : 'OPEN',
          financialTransactionId: financialId,
          providerOperationId: operationId,
          summary: exhausted
            ? 'Bill purchase exhausted automatic same-provider reconciliation attempts'
            : 'Bill provider outcome is unknown and requires same-provider reconciliation',
        });
      }
      await tx.providerOperation.update({ where: { id: operationId }, data: { status: 'UNKNOWN' } });
      const financial = await tx.financialTransaction.findUniqueOrThrow({ where: { id: financialId } });
      if (!['SUCCEEDED', 'FAILED', 'REVERSED', 'CANCELLED'].includes(financial.status) && financial.status !== 'UNKNOWN') {
        await this.financial.applyProviderOutcomeWithTx(tx, financialId, 'UNKNOWN', reason);
      }
    });
  }

  private async deferReconcileAfterQueryFailure(purchaseId: string, financialId: string, operationId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "financial_transactions" WHERE "id" = ${financialId}::uuid FOR UPDATE`;
      const purchase = await tx.billPurchase.findUniqueOrThrow({ where: { id: purchaseId } });
      if (['SUCCEEDED', 'FAILED', 'REVERSED', 'CANCELLED'].includes(purchase.status)) return;
      const attempt = purchase.reconcileAttempts + 1;
      const exhausted = attempt >= reconcilePolicy().maxAttempts;
      await tx.billPurchase.update({
        where: { id: purchase.id },
        data: {
          reconcileAttempts: attempt,
          nextReconcileAt: exhausted ? null : nextReconcileAt(attempt),
          ...(purchase.status === 'UNKNOWN' ? {} : { status: 'UNKNOWN' }),
        },
      });
      await tx.providerOperation.update({ where: { id: operationId }, data: { status: 'UNKNOWN' } });
      const financial = await tx.financialTransaction.findUniqueOrThrow({ where: { id: financialId } });
      if (!['SUCCEEDED', 'FAILED', 'REVERSED', 'CANCELLED'].includes(financial.status) && financial.status !== 'UNKNOWN') {
        await this.financial.applyProviderOutcomeWithTx(tx, financialId, 'UNKNOWN', 'BILL_RECONCILIATION_QUERY_FAILED');
      }
      await this.ensureReconciliationCaseWithTx(tx, {
        type: 'PROVIDER_STATUS_MISMATCH',
        status: exhausted ? 'NEEDS_REVIEW' : 'OPEN',
        financialTransactionId: financialId,
        providerOperationId: operationId,
        summary: exhausted
          ? 'Bill purchase exhausted automatic reconciliation after provider query failures'
          : 'Bill provider reconciliation query failed and will be retried with bounded backoff',
      });
    });
  }

  private async ensureReconciliationCaseWithTx(
    tx: Prisma.TransactionClient,
    input: {
      type: 'PROVIDER_STATUS_MISMATCH' | 'AMOUNT_MISMATCH';
      status: 'OPEN' | 'NEEDS_REVIEW';
      financialTransactionId: string;
      providerOperationId: string;
      summary: string;
      evidence?: Prisma.InputJsonValue;
    },
  ): Promise<void> {
    const existing = await tx.reconciliationCase.findFirst({
      where: {
        providerOperationId: input.providerOperationId,
        type: input.type,
        status: { in: ['OPEN', 'NEEDS_REVIEW'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      await tx.reconciliationCase.update({
        where: { id: existing.id },
        data: {
          ...(existing.status === 'OPEN' && input.status === 'NEEDS_REVIEW' ? { status: 'NEEDS_REVIEW' } : {}),
          summary: input.summary,
          ...(input.evidence !== undefined ? { evidence: input.evidence } : {}),
        },
      });
      return;
    }
    await tx.reconciliationCase.create({
      data: {
        type: input.type,
        status: input.status,
        financialTransactionId: input.financialTransactionId,
        providerOperationId: input.providerOperationId,
        summary: input.summary,
        ...(input.evidence !== undefined ? { evidence: input.evidence } : {}),
      },
    });
  }

  private async applyProviderResult(input: {
    purchaseId: string;
    financialTransactionId: string;
    providerOperationId: string;
    holdId: string;
    walletLedgerAccountId: string;
    providerCode: EnabledBillProvider;
    category: string;
    result: { status: NormalizedProviderStatus; providerReference?: string; providerRequestReference?: string; amountMinor?: bigint; currency?: string; fulfillmentValue?: string; commissionMinor?: bigint; rawStatus?: string };
  }): Promise<'APPLIED' | 'UNKNOWN'> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "financial_transactions" WHERE "id" = ${input.financialTransactionId}::uuid FOR UPDATE`;
      const financial = await tx.financialTransaction.findUniqueOrThrow({ where: { id: input.financialTransactionId } });
      const purchase = await tx.billPurchase.findUniqueOrThrow({ where: { id: input.purchaseId } });
      const operation = await tx.providerOperation.findUniqueOrThrow({ where: { id: input.providerOperationId } });
      const assignedOffer = await tx.billProviderOffer.findUniqueOrThrow({ where: { id: purchase.providerOfferId } });
      // A late, wrongly routed or corrupted provider outcome cannot settle a
      // different purchase or provider offer even if the amount happens to match.
      if (operation.financialTransactionId !== financial.id || purchase.financialTransactionId !== financial.id
        || operation.userId !== purchase.userId || operation.providerCode !== input.providerCode
        || assignedOffer.providerCode !== input.providerCode || operation.type !== 'BILL_PURCHASE'
        || operation.merchantReference !== financial.reference) {
        await this.ensureReconciliationCaseWithTx(tx, {
          type: 'PROVIDER_STATUS_MISMATCH', status: 'NEEDS_REVIEW',
          financialTransactionId: financial.id, providerOperationId: input.providerOperationId,
          summary: 'Bill provider operation, account or selected offer does not match the original instruction',
          evidence: { recordedProvider: operation.providerCode, assignedProvider: assignedOffer.providerCode,
            resultProvider: input.providerCode },
        });
        // Terminal ledgers must not be altered by a contradictory late response.
        if (!['SUCCEEDED','FAILED','REVERSED','CANCELLED'].includes(financial.status)) {
          await tx.providerOperation.update({ where: { id: operation.id }, data: { status: 'UNKNOWN' } });
          if (!['SUCCEEDED','FAILED','REVERSED','CANCELLED','UNKNOWN'].includes(purchase.status)) {
            await this.transitionPurchaseWithTx(tx, purchase.id, 'UNKNOWN');
          }
          if (financial.status !== 'UNKNOWN') await this.financial.applyProviderOutcomeWithTx(tx, financial.id, 'UNKNOWN', 'BILL_PROVIDER_CORRELATION_MISMATCH');
        }
        return 'UNKNOWN';
      }

      const requestReferenceMismatch = Boolean(
        input.result.providerRequestReference
        && purchase.providerRequestReference
        && input.result.providerRequestReference !== purchase.providerRequestReference,
      );
      if (requestReferenceMismatch) {
        await tx.providerOperation.update({
          where: { id: input.providerOperationId },
          data: { status: 'UNKNOWN', rawStatus: input.result.rawStatus ?? null },
        });
        await this.ensureReconciliationCaseWithTx(tx, {
          type: 'PROVIDER_STATUS_MISMATCH',
          status: 'NEEDS_REVIEW',
          financialTransactionId: financial.id,
          providerOperationId: input.providerOperationId,
          summary: 'Bill provider returned a request reference that does not match the pre-submission TwiPay record',
          evidence: { expectedProviderRequestReference: purchase.providerRequestReference, returnedProviderRequestReference: input.result.providerRequestReference ?? null },
        });
        if (!['SUCCEEDED', 'FAILED', 'REVERSED', 'CANCELLED'].includes(purchase.status) && purchase.status !== 'UNKNOWN') {
          await this.transitionPurchaseWithTx(tx, purchase.id, 'UNKNOWN');
        }
        if (!['SUCCEEDED', 'FAILED', 'REVERSED', 'CANCELLED'].includes(financial.status) && financial.status !== 'UNKNOWN') {
          await this.financial.applyProviderOutcomeWithTx(tx, financial.id, 'UNKNOWN', 'BILL_PROVIDER_REQUEST_REFERENCE_MISMATCH');
        }
        return 'UNKNOWN';
      }

      const monetaryEvidenceRequired = input.result.status === 'SUCCEEDED' || input.result.status === 'REVERSED';
      const mismatch = monetaryEvidenceRequired
        ? input.result.amountMinor !== financial.amountMinor || input.result.currency !== financial.currency
        : (input.result.amountMinor !== undefined && input.result.amountMinor !== financial.amountMinor)
          || (input.result.currency !== undefined && input.result.currency !== financial.currency);
      if (mismatch) {
        await tx.providerOperation.update({ where: { id: input.providerOperationId }, data: { status: 'UNKNOWN', rawStatus: input.result.rawStatus ?? null } });
        await this.ensureReconciliationCaseWithTx(tx, {
          type: 'AMOUNT_MISMATCH',
          status: 'NEEDS_REVIEW',
          financialTransactionId: financial.id,
          providerOperationId: input.providerOperationId,
          summary: 'Bill provider monetary evidence does not match TwiPay instruction',
          evidence: { expectedAmountMinor: financial.amountMinor.toString(), providerAmountMinor: input.result.amountMinor?.toString() ?? null, expectedCurrency: financial.currency, providerCurrency: input.result.currency ?? null, providerStatus: input.result.status },
        });
        if (!['SUCCEEDED', 'FAILED', 'REVERSED', 'CANCELLED'].includes(purchase.status)) {
          if (purchase.status !== 'UNKNOWN') await this.transitionPurchaseWithTx(tx, purchase.id, 'UNKNOWN');
          const attempt = purchase.reconcileAttempts + 1;
          const exhausted = attempt >= reconcilePolicy().maxAttempts;
          await tx.billPurchase.update({
            where: { id: purchase.id },
            data: { reconcileAttempts: attempt, nextReconcileAt: exhausted ? null : nextReconcileAt(attempt) },
          });
        }
        if (!['SUCCEEDED', 'FAILED', 'REVERSED', 'CANCELLED'].includes(financial.status) && financial.status !== 'UNKNOWN') await this.financial.applyProviderOutcomeWithTx(tx, financial.id, 'UNKNOWN', 'BILL_PROVIDER_EVIDENCE_MISMATCH');
        return 'UNKNOWN';
      }

      if (['SUCCEEDED', 'FAILED', 'REVERSED', 'CANCELLED'].includes(financial.status)) {
        const compatible = financial.status === input.result.status;
        const legitimateReversal = financial.status === 'SUCCEEDED' && input.result.status === 'REVERSED';
        if (!compatible && !legitimateReversal) {
          await this.ensureReconciliationCaseWithTx(tx, {
            type: 'PROVIDER_STATUS_MISMATCH',
            status: 'NEEDS_REVIEW',
            financialTransactionId: financial.id,
            providerOperationId: input.providerOperationId,
            summary: `Bill provider reports ${input.result.status} while TwiPay is terminal ${financial.status}`,
          });
          return 'UNKNOWN';
        }
        if (compatible) return 'APPLIED';
      }

      await tx.providerOperation.update({
        where: { id: input.providerOperationId },
        data: {
          status: operationStatus(input.result.status),
          providerReference: input.result.providerReference ?? undefined,
          rawStatus: input.result.rawStatus ?? undefined,
        },
      });
      await tx.billPurchase.update({
        where: { id: input.purchaseId },
        data: {
          providerReference: input.result.providerReference ?? undefined,
          commissionMinor: input.result.commissionMinor ?? undefined,
        },
      });

      if (input.result.status === 'SUCCEEDED') {
        const clearing = await this.wallets.systemAccountWithTx(tx, {
          code: `provider-bill-clearing:${input.providerCode}`,
          name: `${input.providerCode} bill-service clearing`,
          category: 'ASSET', normalBalance: 'DEBIT', currency: 'NGN',
        });
        const journalReference = `jrn:${financial.reference}:bill`;
        const existingJournal = await tx.journalTransaction.findUnique({ where: { reference: journalReference }, select: { id: true } });
        if (!existingJournal) {
          await this.ledger.postWithTx(tx, {
            reference: journalReference,
            financialTransactionId: financial.id,
            currency: 'NGN',
            description: 'Verified bill-service fulfillment',
            entries: [
              { accountId: input.walletLedgerAccountId, side: 'DEBIT', amountMinor: financial.amountMinor },
              { accountId: clearing.id, side: 'CREDIT', amountMinor: financial.amountMinor },
            ],
          });
        }
        const hold = await tx.walletHold.findUniqueOrThrow({ where: { id: input.holdId } });
        if (hold.status === 'ACTIVE') await this.wallets.captureHoldWithTx(tx, hold.id);
        if (purchase.status !== 'SUCCEEDED') await this.transitionPurchaseWithTx(tx, purchase.id, 'SUCCEEDED');
        await tx.billPurchase.update({ where: { id: purchase.id }, data: { nextReconcileAt: null } });
        const currentFinancial = await tx.financialTransaction.findUniqueOrThrow({ where: { id: financial.id } });
        if (currentFinancial.status !== 'SUCCEEDED') await this.financial.applyProviderOutcomeWithTx(tx, financial.id, 'SUCCEEDED', 'BILL_PROVIDER_VERIFIED_SUCCESS');
        if (input.result.fulfillmentValue) {
          await tx.billPurchase.update({ where: { id: purchase.id }, data: { fulfillmentCiphertext: encryptSensitiveString(input.result.fulfillmentValue, process.env['DATA_ENCRYPTION_KEY']!) } });
        }
        return 'APPLIED';
      }

      if (input.result.status === 'REVERSED' && financial.status === 'SUCCEEDED') {
        const journal = await tx.journalTransaction.findUniqueOrThrow({ where: { reference: `jrn:${financial.reference}:bill` } });
        const reversalRef = `jrn:${financial.reference}:bill-reversal`;
        const existing = await tx.journalTransaction.findUnique({ where: { reference: reversalRef }, select: { id: true } });
        if (!existing) await this.ledger.reverseWithTx(tx, journal.id, reversalRef, 'Provider-confirmed bill-service reversal');
        await this.transitionPurchaseWithTx(tx, purchase.id, 'REVERSED');
        await tx.billPurchase.update({ where: { id: purchase.id }, data: { nextReconcileAt: null } });
        await this.financial.transitionWithTx(tx, financial.id, 'REVERSED', 'BILL_PROVIDER_REVERSED', 'PROVIDER');
        return 'APPLIED';
      }

      if (input.result.status === 'FAILED' || input.result.status === 'REVERSED') {
        const hold = await tx.walletHold.findUniqueOrThrow({ where: { id: input.holdId } });
        if (hold.status === 'ACTIVE') await this.wallets.releaseHoldWithTx(tx, hold.id);
        await this.transitionPurchaseWithTx(tx, purchase.id, input.result.status);
        await tx.billPurchase.update({ where: { id: purchase.id }, data: { nextReconcileAt: null } });
        const currentFinancial = await tx.financialTransaction.findUniqueOrThrow({ where: { id: financial.id } });
        if (currentFinancial.status !== input.result.status) await this.financial.applyProviderOutcomeWithTx(tx, financial.id, input.result.status, 'BILL_PROVIDER_VERIFIED_TERMINAL');
        return 'APPLIED';
      }

      const target = input.result.status === 'PROCESSING' || input.result.status === 'PENDING' || input.result.status === 'REQUIRES_ACTION' ? 'PROCESSING' : 'UNKNOWN';
      if (purchase.status !== target) await this.transitionPurchaseWithTx(tx, purchase.id, target);
      const attempt = purchase.reconcileAttempts + 1;
      const exhausted = attempt >= reconcilePolicy().maxAttempts;
      await tx.billPurchase.update({
        where: { id: purchase.id },
        data: { reconcileAttempts: attempt, nextReconcileAt: exhausted ? null : nextReconcileAt(attempt) },
      });
      if (exhausted) {
        await this.ensureReconciliationCaseWithTx(tx, {
          type: 'PROVIDER_STATUS_MISMATCH',
          status: 'NEEDS_REVIEW',
          financialTransactionId: financial.id,
          providerOperationId: input.providerOperationId,
          summary: 'Bill purchase exhausted automatic same-provider reconciliation attempts',
        });
      }
      const currentFinancial = await tx.financialTransaction.findUniqueOrThrow({ where: { id: financial.id } });
      if (currentFinancial.status !== target) await this.financial.applyProviderOutcomeWithTx(tx, financial.id, target, 'BILL_PROVIDER_PENDING_OR_UNKNOWN');
      return target === 'UNKNOWN' ? 'UNKNOWN' : 'APPLIED';
    });
  }
}
