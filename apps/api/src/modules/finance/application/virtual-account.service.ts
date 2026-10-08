import { Injectable } from '@nestjs/common';
import type { JsonObject, VirtualAccountAssignmentEvent, VirtualAccountResult } from '@twipay/contracts';
import {
  decryptSensitiveString,
  encryptSensitiveString,
  fingerprintSensitiveValue,
} from '@twipay/security';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { PaymentProviderRegistry, type EnabledPaymentProvider } from '../../providers/payment-provider.registry.js';
import { IdempotencyService } from './idempotency.service.js';
import { createFinancialReference } from './reference.js';

const ACTIVE_PROVIDER_OPERATION_STATES = ['PENDING', 'PROCESSING', 'REQUIRES_ACTION', 'UNKNOWN'] as const;

@Injectable()
export class VirtualAccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: PaymentProviderRegistry,
    private readonly idempotency: IdempotencyService,
  ) {}

  async create(input: {
    userId: string;
    idempotencyKey: string;
    providerCode: EnabledPaymentProvider;
    preferredBank?: string;
    consent: true;
    validationBankCode?: string;
    validationAccountNumber?: string;
  }): Promise<{ statusCode: number; body: JsonObject }> {
    const provider = this.providers.get(input.providerCode);
    const idem = await this.idempotency.begin({
      scope: 'virtual-account:create',
      key: input.idempotencyKey,
      userId: input.userId,
      request: input,
    });
    if (idem.replay) return { statusCode: idem.replay.status, body: idem.replay.body };
    const recordId = idem.recordId!;

    const existing = await this.prisma.virtualAccount.findUnique({
      where: { userId_providerCode_currency: { userId: input.userId, providerCode: input.providerCode, currency: 'NGN' } },
    });
    if (existing?.status === 'ACTIVE') {
      const body = this.virtualAccountBody(existing, decryptSensitiveString(existing.accountNumberCiphertext, process.env['DATA_ENCRYPTION_KEY']!));
      await this.idempotency.complete(recordId, 200, body);
      return { statusCode: 200, body };
    }

    const pending = await this.prisma.providerOperation.findFirst({
      where: {
        userId: input.userId,
        providerCode: input.providerCode,
        type: 'VIRTUAL_ACCOUNT',
        status: { in: [...ACTIVE_PROVIDER_OPERATION_STATES] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (pending) {
      const body: JsonObject = {
        provider: input.providerCode,
        reference: pending.merchantReference,
        status: pending.status === 'UNKNOWN' ? 'UNKNOWN' : 'PENDING',
        code: 'VIRTUAL_ACCOUNT_PROVISIONING_IN_PROGRESS',
      };
      await this.idempotency.complete(recordId, 202, body);
      return { statusCode: 202, body };
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: input.userId } });

    // V1 deliberately requires the stronger BVN-backed path for wallet funding,
    // even where a provider also accepts NIN. NIN remains available for future
    // identity tiers but does not by itself authorize a funding account.
    const verification = await this.prisma.identityVerification.findFirst({
      where: { userId: input.userId, status: 'VERIFIED', type: 'BVN' },
      orderBy: { updatedAt: 'desc' },
    });
    if (!verification) {
      const body: JsonObject = { code: 'VERIFIED_BVN_REQUIRED', provider: input.providerCode };
      await this.idempotency.fail(recordId, 409, body);
      return { statusCode: 409, body };
    }

    if (input.providerCode === 'paystack') {
      if (!input.validationBankCode || !input.validationAccountNumber) {
        const body: JsonObject = { code: 'PAYSTACK_VALIDATION_BANK_ACCOUNT_REQUIRED' };
        await this.idempotency.fail(recordId, 422, body);
        return { statusCode: 422, body };
      }
      try {
        await provider.resolveBankAccount({
          bankCode: input.validationBankCode,
          accountNumber: input.validationAccountNumber,
          currency: 'NGN',
        });
      } catch {
        const body: JsonObject = { code: 'PAYSTACK_VALIDATION_BANK_ACCOUNT_INVALID' };
        await this.idempotency.fail(recordId, 422, body);
        return { statusCode: 422, body };
      }
    }

    const identifier = decryptSensitiveString(verification.identifierCiphertext, process.env['DATA_ENCRYPTION_KEY']!);
    const reference = createFinancialReference('va');
    const consentRecordedAt = new Date();
    const correlationKey = fingerprintSensitiveValue(user.email.trim().toLowerCase(), process.env['PII_FINGERPRINT_KEY']!);
    const operation = await this.prisma.providerOperation.create({
      data: {
        userId: input.userId,
        type: 'VIRTUAL_ACCOUNT',
        providerCode: input.providerCode,
        merchantReference: reference,
        status: 'PENDING',
        correlationKey,
      },
    });
    await this.idempotency.attachResource(recordId, 'provider_operation', operation.id);

    try {
      const result = await provider.createVirtualAccount({
        reference,
        currency: 'NGN',
        customer: {
          email: user.email,
          fullName: [user.givenName, user.familyName].filter(Boolean).join(' ') || user.email,
          ...(user.givenName ? { firstName: user.givenName } : {}),
          ...(user.familyName ? { lastName: user.familyName } : {}),
          ...(user.phoneE164 ? { phoneE164: user.phoneE164 } : {}),
        },
        ...(input.preferredBank ? { preferredBank: input.preferredBank } : {}),
        consentRecordedAt: consentRecordedAt.toISOString(),
        identity: {
          bvn: identifier,
          ...(input.providerCode === 'paystack' && input.validationAccountNumber
            ? { bankAccountNumber: input.validationAccountNumber }
            : {}),
          ...(input.providerCode === 'paystack' && input.validationBankCode
            ? { bankCode: input.validationBankCode }
            : {}),
        },
      });

      const operationStatus = result.status === 'ACTIVE'
        ? 'SUCCEEDED'
        : result.status === 'FAILED'
          ? 'FAILED'
          : 'PENDING';
      await this.prisma.providerOperation.update({
        where: { id: operation.id },
        data: {
          ...(result.providerAccountId ? { providerReference: result.providerAccountId } : {}),
          status: operationStatus,
        },
      });

      if (result.status === 'ACTIVE') {
        await this.prisma.$transaction((tx) => this.persistAssignedAccountWithTx(tx, {
          userId: input.userId,
          providerCode: input.providerCode,
          accountReference: reference,
          consentRecordedAt,
          result,
        }));
      }

      const body: JsonObject = {
        provider: input.providerCode,
        reference,
        status: result.status,
        ...(result.accountNumber ? { accountNumber: result.accountNumber } : {}),
        ...(result.accountName ? { accountName: result.accountName } : {}),
        ...(result.bankName ? { bankName: result.bankName } : {}),
        ...(result.bankCode ? { bankCode: result.bankCode } : {}),
      };
      const statusCode = result.status === 'ACTIVE' ? 201 : 202;
      await this.idempotency.complete(recordId, statusCode, body);
      return { statusCode, body };
    } catch {
      await this.prisma.providerOperation.update({ where: { id: operation.id }, data: { status: 'UNKNOWN' } });
      const body: JsonObject = {
        provider: input.providerCode,
        reference,
        status: 'UNKNOWN',
        code: 'VIRTUAL_ACCOUNT_OUTCOME_UNKNOWN',
      };
      await this.idempotency.complete(recordId, 202, body);
      return { statusCode: 202, body };
    }
  }


  // Read-only, owner-scoped lifecycle visibility even when the provider has not
  // assigned an account yet. Never return BVN, correlation fingerprints or provider secrets.
  async listProvisioningForUser(userId: string): Promise<JsonObject[]> {
    const rows = await this.prisma.providerOperation.findMany({
      where: { userId, type: 'VIRTUAL_ACCOUNT' },
      select: { merchantReference: true, providerCode: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return rows.map(row => ({
      reference: row.merchantReference,
      provider: row.providerCode,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async listForUser(userId: string): Promise<JsonObject[]> {
    const rows = await this.prisma.virtualAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.virtualAccountBody(
      row,
      decryptSensitiveString(row.accountNumberCiphertext, process.env['DATA_ENCRYPTION_KEY']!),
    ));
  }

  async applyProviderAssignment(providerCode: EnabledPaymentProvider, assignment: VirtualAccountAssignmentEvent): Promise<void> {
    if (!assignment.customerEmail) {
      await this.prisma.reconciliationCase.create({
        data: {
          type: 'MISSING_INTERNAL',
          status: 'NEEDS_REVIEW',
          summary: 'Virtual-account assignment webhook could not be correlated because customer email was absent',
          evidence: { providerCode, assignmentStatus: assignment.status },
        },
      });
      return;
    }

    const correlationKey = fingerprintSensitiveValue(
      assignment.customerEmail.trim().toLowerCase(),
      process.env['PII_FINGERPRINT_KEY']!,
    );
    const operation = await this.prisma.providerOperation.findFirst({
      where: { providerCode, type: 'VIRTUAL_ACCOUNT', correlationKey },
      orderBy: { createdAt: 'desc' },
    });
    if (!operation?.userId) {
      await this.prisma.reconciliationCase.create({
        data: {
          type: 'MISSING_INTERNAL',
          status: 'NEEDS_REVIEW',
          summary: 'Virtual-account assignment webhook could not be mapped to a TwiPay provisioning operation',
          evidence: { providerCode, assignmentStatus: assignment.status },
        },
      });
      return;
    }

    const activeOperation = (ACTIVE_PROVIDER_OPERATION_STATES as readonly string[]).includes(operation.status);
    if (!activeOperation) {
      const compatible =
        (operation.status === 'SUCCEEDED' && assignment.status === 'ACTIVE') ||
        (operation.status === 'FAILED' && assignment.status === 'FAILED');
      if (!compatible) {
        await this.prisma.reconciliationCase.create({
          data: {
            type: 'PROVIDER_STATUS_MISMATCH',
            status: 'NEEDS_REVIEW',
            providerOperationId: operation.id,
            summary: `Provider virtual-account assignment ${assignment.status} contradicts terminal TwiPay operation ${operation.status}`,
            evidence: { providerCode, twipayStatus: operation.status, providerAssignmentStatus: assignment.status },
          },
        });
      }
      return;
    }

    if (assignment.status === 'FAILED') {
      await this.prisma.providerOperation.update({ where: { id: operation.id }, data: { status: 'FAILED' } });
      return;
    }

    if (!assignment.providerAccountId || !assignment.accountNumber || !assignment.accountName || !assignment.bankName) {
      await this.prisma.providerOperation.update({ where: { id: operation.id }, data: { status: 'UNKNOWN' } });
      await this.prisma.reconciliationCase.create({
        data: {
          type: 'MISSING_PROVIDER',
          status: 'NEEDS_REVIEW',
          providerOperationId: operation.id,
          summary: 'Successful virtual-account assignment omitted required account fields',
          evidence: { providerCode },
        },
      });
      return;
    }
    if (assignment.currency && assignment.currency !== 'NGN') {
      await this.prisma.$transaction(async (tx) => {
        await tx.providerOperation.update({ where: { id: operation.id }, data: { status: 'UNKNOWN' } });
        await tx.reconciliationCase.create({
          data: {
            type: 'AMOUNT_MISMATCH',
            status: 'NEEDS_REVIEW',
            providerOperationId: operation.id,
            summary: 'Virtual-account assignment currency conflicts with the V1 NGN wallet policy',
            evidence: { providerCode, assignmentCurrency: assignment.currency },
          },
        });
      });
      return;
    }

    const result: VirtualAccountResult = {
      providerCode,
      providerAccountId: assignment.providerAccountId,
      reference: operation.merchantReference,
      accountNumber: assignment.accountNumber,
      accountName: assignment.accountName,
      ...(assignment.bankCode ? { bankCode: assignment.bankCode } : {}),
      bankName: assignment.bankName,
      currency: assignment.currency ?? 'NGN',
      status: 'ACTIVE',
    };

    await this.prisma.$transaction(async (tx) => {
      await this.persistAssignedAccountWithTx(tx, {
        userId: operation.userId!,
        providerCode,
        accountReference: operation.merchantReference,
        consentRecordedAt: operation.createdAt,
        result,
      });
      await tx.providerOperation.update({
        where: { id: operation.id },
        data: { status: 'SUCCEEDED', providerReference: assignment.providerAccountId },
      });
    });
  }

  private async persistAssignedAccountWithTx(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      providerCode: EnabledPaymentProvider;
      accountReference: string;
      consentRecordedAt: Date;
      result: VirtualAccountResult;
    },
  ): Promise<void> {
    const { result } = input;
    if (!result.providerAccountId || !result.accountNumber || !result.accountName || !result.bankName) {
      throw new Error('VIRTUAL_ACCOUNT_ASSIGNMENT_INCOMPLETE');
    }
    const fingerprint = fingerprintSensitiveValue(result.accountNumber, process.env['PII_FINGERPRINT_KEY']!);
    const ciphertext = encryptSensitiveString(result.accountNumber, process.env['DATA_ENCRYPTION_KEY']!);
    await tx.virtualAccount.upsert({
      where: {
        userId_providerCode_currency: {
          userId: input.userId,
          providerCode: input.providerCode,
          currency: result.currency,
        },
      },
      create: {
        userId: input.userId,
        providerCode: input.providerCode,
        providerAccountId: result.providerAccountId,
        accountReference: input.accountReference,
        accountNumberCiphertext: ciphertext,
        accountNumberFingerprint: fingerprint,
        accountNumberLast4: result.accountNumber.slice(-4),
        accountName: result.accountName,
        ...(result.bankCode ? { bankCode: result.bankCode } : {}),
        bankName: result.bankName,
        currency: result.currency,
        status: 'ACTIVE',
        consentRecordedAt: input.consentRecordedAt,
      },
      update: {
        providerAccountId: result.providerAccountId,
        accountReference: input.accountReference,
        accountNumberCiphertext: ciphertext,
        accountNumberFingerprint: fingerprint,
        accountNumberLast4: result.accountNumber.slice(-4),
        accountName: result.accountName,
        ...(result.bankCode ? { bankCode: result.bankCode } : {}),
        bankName: result.bankName,
        status: 'ACTIVE',
      },
    });
  }

  private virtualAccountBody(
    account: {
      providerCode: string;
      accountReference: string;
      accountName: string;
      bankCode: string | null;
      bankName: string;
      currency: string;
      status: string;
    },
    accountNumber: string,
  ): JsonObject {
    return {
      provider: account.providerCode,
      reference: account.accountReference,
      status: account.status,
      accountNumber,
      accountName: account.accountName,
      bankName: account.bankName,
      ...(account.bankCode ? { bankCode: account.bankCode } : {}),
      currency: account.currency,
    };
  }
}
