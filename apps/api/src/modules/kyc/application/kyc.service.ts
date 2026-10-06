import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import type { JsonObject } from '@twipay/contracts';
import { encryptSensitiveString, fingerprintSensitiveValue } from '@twipay/security';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { IdentityProviderRegistry } from '../../providers/identity-provider.registry.js';
import { IdempotencyService } from '../../finance/application/idempotency.service.js';
import { createFinancialReference } from '../../finance/application/reference.js';

@Injectable()
export class KycService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: IdentityProviderRegistry,
    private readonly idempotency: IdempotencyService,
  ) {}

  async initiate(input: {
    userId: string;
    idempotencyKey: string;
    type: 'BVN' | 'NIN';
    identifier: string;
    consent: true;
    scope?: 'identity' | 'bank_accounts';
  }): Promise<{ statusCode: number; body: JsonObject }> {
    const fingerprintKey = process.env.PII_FINGERPRINT_KEY!;
    const encryptionKey = process.env.DATA_ENCRYPTION_KEY!;
    const fingerprint = fingerprintSensitiveValue(input.identifier, fingerprintKey);
    const idem = await this.idempotency.begin({
      scope: `kyc:${input.type.toLowerCase()}:initiate`,
      key: input.idempotencyKey,
      userId: input.userId,
      request: { type: input.type, fingerprint, scope: input.scope ?? 'identity' },
      ttlHours: 1,
    });
    if (idem.replay) return { statusCode: idem.replay.status, body: idem.replay.body };
    const recordId = idem.recordId!;

    // Reuse a previously verified identity before applying provider-call rate
    // limits. A verified result needs no external request, so blocking it would
    // neither improve abuse resistance nor reduce provider cost.
    const verifiedExisting = await this.prisma.identityVerification.findFirst({
      where: {
        userId: input.userId,
        type: input.type,
        identifierFingerprint: fingerprint,
        status: 'VERIFIED',
      },
      orderBy: { updatedAt: 'desc' },
    });
    if (verifiedExisting) {
      const body: JsonObject = { verificationId: verifiedExisting.id, status: 'VERIFIED', reused: true };
      await this.idempotency.complete(recordId, 200, body);
      return { statusCode: 200, body };
    }

    const recentInFlight = await this.prisma.identityVerification.findFirst({
      where: {
        userId: input.userId,
        type: input.type,
        identifierFingerprint: fingerprint,
        status: { in: ['AWAITING_CONSENT', 'PENDING'] },
        createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recentInFlight) {
      const body: JsonObject = { verificationId: recentInFlight.id, status: recentInFlight.status, reused: true };
      await this.idempotency.complete(recordId, 202, body);
      return { statusCode: 202, body };
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAttempts = await this.prisma.identityVerification.count({
      where: { userId: input.userId, type: input.type, createdAt: { gte: oneHourAgo } },
    });
    if (recentAttempts >= 3) {
      const body: JsonObject = { code: 'KYC_RATE_LIMITED', retryAfterSeconds: 3600 };
      await this.idempotency.fail(recordId, 429, body);
      throw new HttpException(body, HttpStatus.TOO_MANY_REQUESTS);
    }

    const merchantReference = createFinancialReference('kyc');
    const verification = await this.prisma.identityVerification.create({
      data: {
        userId: input.userId,
        type: input.type,
        providerCode: 'mono',
        merchantReference,
        identifierFingerprint: fingerprint,
        identifierCiphertext: encryptSensitiveString(input.identifier, encryptionKey),
        identifierLast4: input.identifier.slice(-4),
        consentRecordedAt: new Date(),
        status: 'CREATED',
      },
    });
    await this.idempotency.attachResource(recordId, 'identity_verification', verification.id);

    try {
      const result = await this.providers.get('mono').initiateIdentityCheck({
        reference: merchantReference,
        type: input.type,
        identifier: input.identifier,
        ...(input.scope ? { scope: input.scope } : {}),
      });
      await this.prisma.identityVerification.update({
        where: { id: verification.id },
        data: {
          status: result.status,
          providerReference: result.providerReference,
          result: { providerStatus: result.rawStatus ?? null, verified: result.status === 'VERIFIED' },
          ...(result.status === 'AWAITING_CONSENT' ? { expiresAt: new Date(Date.now() + 10 * 60 * 1000) } : {}),
        },
      });
      const methods = result.status === 'AWAITING_CONSENT' && Array.isArray(result.attributes?.methods)
        ? result.attributes.methods
        : [];
      const body: JsonObject = {
        verificationId: verification.id,
        type: input.type,
        status: result.status,
        ...(methods.length ? { verificationMethods: methods } : {}),
      };
      await this.idempotency.complete(recordId, result.status === 'VERIFIED' ? 200 : 202, body);
      return { statusCode: result.status === 'VERIFIED' ? 200 : 202, body };
    } catch (error) {
      // A transport/provider exception does not prove the upstream did not process
      // the paid verification. Preserve it as pending/unknown so retries do not
      // blindly create duplicate provider charges.
      await this.prisma.identityVerification.update({
        where: { id: verification.id },
        data: { status: 'PENDING', result: { providerStatus: 'UNKNOWN' } },
      });
      const body: JsonObject = { verificationId: verification.id, status: 'PENDING', code: 'KYC_PROVIDER_OUTCOME_UNKNOWN' };
      await this.idempotency.complete(recordId, 202, body);
      return { statusCode: 202, body };
    }
  }

  async continue(input: {
    userId: string;
    verificationId: string;
    idempotencyKey: string;
    action: 'REQUEST_OTP' | 'SUBMIT_OTP';
    verificationMethod?: string;
    phoneNumber?: string;
    otp?: string;
  }): Promise<{ statusCode: number; body: JsonObject }> {
    const verification = await this.prisma.identityVerification.findFirst({ where: { id: input.verificationId, userId: input.userId } });
    if (!verification) throw new NotFoundException({ code: 'KYC_VERIFICATION_NOT_FOUND' });

    if (verification.status === 'VERIFIED') {
      return {
        statusCode: 200,
        body: { verificationId: verification.id, type: verification.type, status: 'VERIFIED', reused: true },
      };
    }
    if (verification.status === 'FAILED' || verification.status === 'EXPIRED') {
      throw new HttpException({ code: 'KYC_VERIFICATION_NOT_CONTINUABLE', status: verification.status }, 409);
    }
    if (verification.expiresAt && verification.expiresAt.getTime() <= Date.now()) {
      await this.prisma.identityVerification.update({ where: { id: verification.id }, data: { status: 'EXPIRED' } });
      throw new HttpException({ code: 'KYC_VERIFICATION_EXPIRED' }, 409);
    }
    if (input.action === 'REQUEST_OTP' && verification.status !== 'AWAITING_CONSENT') {
      throw new HttpException({ code: 'KYC_OTP_REQUEST_NOT_ALLOWED', status: verification.status }, 409);
    }
    if (input.action === 'SUBMIT_OTP' && !['AWAITING_CONSENT', 'PENDING'].includes(verification.status)) {
      throw new HttpException({ code: 'KYC_OTP_SUBMISSION_NOT_ALLOWED', status: verification.status }, 409);
    }
    if (!verification.providerReference) throw new HttpException({ code: 'KYC_PROVIDER_REFERENCE_MISSING' }, 409);
    const idem = await this.idempotency.begin({
      scope: `kyc:${verification.id}:${input.action.toLowerCase()}`,
      key: input.idempotencyKey,
      userId: input.userId,
      request: { verificationId: verification.id, action: input.action, verificationMethod: input.verificationMethod ?? null, phoneNumber: input.phoneNumber ? 'provided' : null, otp: input.otp ? 'provided' : null },
      ttlHours: 1,
    });
    if (idem.replay) return { statusCode: idem.replay.status, body: idem.replay.body };
    const recordId = idem.recordId!;

    try {
      const result = await this.providers.get('mono').continueIdentityCheck({
        providerReference: verification.providerReference,
        action: input.action,
        ...(input.verificationMethod ? { verificationMethod: input.verificationMethod } : {}),
        ...(input.phoneNumber ? { phoneNumber: input.phoneNumber } : {}),
        ...(input.otp ? { otp: input.otp } : {}),
      });
      await this.prisma.identityVerification.update({
        where: { id: verification.id },
        data: {
          status: result.status,
          result: { providerStatus: result.rawStatus ?? null, verified: result.status === 'VERIFIED' },
          ...(result.status === 'VERIFIED' ? { expiresAt: null } : {}),
        },
      });
      const body: JsonObject = { verificationId: verification.id, type: verification.type, status: result.status };
      await this.idempotency.complete(recordId, result.status === 'VERIFIED' ? 200 : 202, body);
      return { statusCode: result.status === 'VERIFIED' ? 200 : 202, body };
    } catch (error) {
      await this.prisma.identityVerification.update({
        where: { id: verification.id },
        data: { status: 'PENDING', result: { providerStatus: 'UNKNOWN' } },
      });
      const body: JsonObject = { verificationId: verification.id, status: 'PENDING', code: 'KYC_PROVIDER_OUTCOME_UNKNOWN' };
      await this.idempotency.complete(recordId, 202, body);
      return { statusCode: 202, body };
    }
  }

  async status(userId: string) {
    const rows = await this.prisma.identityVerification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, type: true, status: true, identifierLast4: true, providerCode: true, createdAt: true, updatedAt: true },
    });
    return rows;
  }
}
