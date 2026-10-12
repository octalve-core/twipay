import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import type { JsonObject } from '@twipay/contracts';
import { encryptSensitiveString, fingerprintSensitiveValue } from '@twipay/security';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { IdentityProviderRegistry } from '../../providers/identity-provider.registry.js';
import { IdempotencyService } from '../../finance/application/idempotency.service.js';
import { createFinancialReference } from '../../finance/application/reference.js';

// Persist only whitelisted provider method names, never OTPs, phone details or raw provider payloads.
function publicVerificationMethods(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string =>
    typeof item === 'string' && item.trim().length >= 2 && item.trim().length <= 40))].slice(0, 10);
}

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
    const fingerprintKey = process.env['PII_FINGERPRINT_KEY']!;
    const encryptionKey = process.env['DATA_ENCRYPTION_KEY']!;
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
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
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
      const methods = result.status === 'AWAITING_CONSENT'
        ? publicVerificationMethods(result.attributes?.['methods']) : [];
      await this.prisma.identityVerification.update({
        where: { id: verification.id },
        data: {
          status: result.status,
          providerReference: result.providerReference,
          result: { providerStatus: result.rawStatus ?? null, verified: result.status === 'VERIFIED', verificationMethods: methods, otpRequested: false },
          ...(result.status === 'AWAITING_CONSENT' ? { expiresAt: new Date(Date.now() + 10 * 60 * 1000) } : {}),
        },
      });
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
    const recorded: Record<string, unknown> = verification.result && typeof verification.result === 'object' && !Array.isArray(verification.result) ? verification.result as Record<string, unknown> : {};
    if (input.action === 'REQUEST_OTP') {
      const available = publicVerificationMethods(recorded['verificationMethods']);
      if (!input.verificationMethod || !available.includes(input.verificationMethod)) {
        throw new HttpException({ code: 'KYC_VERIFICATION_METHOD_UNAVAILABLE' }, 409);
      }
    }
    if (input.action === 'SUBMIT_OTP' && recorded['otpRequested'] !== true) {
      throw new HttpException({ code: 'KYC_OTP_NOT_REQUESTED' }, 409);
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
          result: { providerStatus: result.rawStatus ?? null, verified: result.status === 'VERIFIED',
            verificationMethods: publicVerificationMethods(recorded['verificationMethods']),
            otpRequested: input.action === 'REQUEST_OTP' && result.status === 'PENDING' },
          ...(result.status === 'VERIFIED' ? { expiresAt: null } : {}),
        },
      });
      const body: JsonObject = { verificationId: verification.id, type: verification.type, status: result.status };
      await this.idempotency.complete(recordId, result.status === 'VERIFIED' ? 200 : 202, body);
      return { statusCode: result.status === 'VERIFIED' ? 200 : 202, body };
    } catch (error) {
      await this.prisma.identityVerification.update({
        where: { id: verification.id },
        data: { status: 'PENDING', result: { providerStatus: 'UNKNOWN', verificationMethods: publicVerificationMethods(recorded['verificationMethods']), otpRequested: false } },
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
      select: { id: true, type: true, status: true, identifierLast4: true, providerCode: true,
        expiresAt: true, result: true, createdAt: true, updatedAt: true },
    });
    return rows.map(row => {
      const detail: Record<string, unknown> = row.result && typeof row.result === 'object' && !Array.isArray(row.result) ? row.result as Record<string, unknown> : {};
      const status = row.expiresAt && row.expiresAt.getTime() <= Date.now() && row.status === 'AWAITING_CONSENT'
        ? 'EXPIRED' : row.status;
      return { id: row.id, type: row.type, status, identifierLast4: row.identifierLast4,
        providerCode: row.providerCode, expiresAt: row.expiresAt, createdAt: row.createdAt, updatedAt: row.updatedAt,
        verificationMethods: status === 'AWAITING_CONSENT' ? publicVerificationMethods(detail['verificationMethods']) : [],
        otpRequested: status === 'PENDING' && detail['otpRequested'] === true };
    });
  }
}
