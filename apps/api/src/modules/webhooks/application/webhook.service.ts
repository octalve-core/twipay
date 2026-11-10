import { createHash } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { RawWebhookRequest, VerifiedWebhook, VirtualAccountAssignmentEvent, VirtualAccountCreditEvent } from '@twipay/contracts';
import { decryptSensitiveString, encryptSensitiveString } from '@twipay/security';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { PaymentProviderRegistry, type EnabledPaymentProvider } from '../../providers/payment-provider.registry.js';
import { PaymentService } from '../../finance/application/payment.service.js';
import { TransferService } from '../../finance/application/transfer.service.js';
import { VirtualAccountService } from '../../finance/application/virtual-account.service.js';

function deduplicationKey(provider: string, eventType: string, externalId: string | undefined, payloadHash: string): string {
  return createHash('sha256').update(`${provider}|${eventType}|${externalId ?? payloadHash}`).digest('hex');
}

/**
 * A claim (VERIFIED -> PROCESSING) whose process died stays PROCESSING for ever, and the provider's redelivery used to be answered
 * "duplicate, processing" with a success status, so the provider stopped retrying and nothing re-ran the event. Handling one event
 * takes a provider requery (10 s timeout) and a database transaction, so a claim older than this has no live owner.
 */
export const STALE_WEBHOOK_CLAIM_MS = 5 * 60 * 1000;

/** What `processVerified` needs from a delivery; everything else on a verified webhook is already stored in columns. */
export type RecoverableWebhook = Pick<VerifiedWebhook, 'merchantReference' | 'virtualAccountAssignment' | 'virtualAccountCredit'>;
type VirtualAccountFields = Pick<VerifiedWebhook, 'virtualAccountAssignment' | 'virtualAccountCredit'>;

/**
 * Virtual-account deliveries carry an account number and a customer email, so a copy kept for recovery is encrypted, and only when
 * the delivery has such fields. Collection and payout events are rebuilt from the stored merchant reference alone.
 */
export function sealRecoveryPayload(verified: VirtualAccountFields, key: string): string | undefined {
  if (!verified.virtualAccountAssignment && !verified.virtualAccountCredit) return undefined;
  const credit = verified.virtualAccountCredit;
  return encryptSensitiveString(JSON.stringify({
    ...(verified.virtualAccountAssignment ? { assignment: verified.virtualAccountAssignment } : {}),
    ...(credit ? { credit: { ...credit, ...(credit.amountMinor !== undefined ? { amountMinor: credit.amountMinor.toString() } : {}) } } : {}),
  }), key);
}

export function openRecoveryPayload(ciphertext: string, key: string): VirtualAccountFields {
  const parsed = JSON.parse(decryptSensitiveString(ciphertext, key)) as { assignment?: VirtualAccountAssignmentEvent; credit?: Omit<VirtualAccountCreditEvent, 'amountMinor'> & { amountMinor?: string } };
  return {
    ...(parsed.assignment ? { virtualAccountAssignment: parsed.assignment } : {}),
    ...(parsed.credit ? { virtualAccountCredit: { ...parsed.credit, ...(parsed.credit.amountMinor !== undefined ? { amountMinor: BigInt(parsed.credit.amountMinor) } : {}) } as VirtualAccountCreditEvent } : {}),
  };
}

interface ClaimableEvent {
  id: string;
  status: string;
  receivedAt: Date;
  processingStartedAt: Date | null;
}

/** When the current claim began; rows claimed before the column existed fall back to when they arrived. */
function claimStartedAt(event: ClaimableEvent): Date {
  return event.processingStartedAt ?? event.receivedAt;
}

@Injectable()
export class WebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: PaymentProviderRegistry,
    private readonly payments: PaymentService,
    private readonly transfers: TransferService,
    private readonly virtualAccounts: VirtualAccountService,
  ) {}

  async receive(providerCode: EnabledPaymentProvider, request: RawWebhookRequest) {
    // Re-verify every delivery, including provider retries. A prior failed local
    // processing attempt does not make a repeated signed delivery trustworthy by
    // itself; the current envelope must still pass the provider signature check.
    let verified: VerifiedWebhook;
    try {
      verified = await this.providers.get(providerCode).verifyWebhook(request);
    } catch {
      // Never return provider parser/signature details to a public webhook caller.
      // A generic 401 is deliberate: providers may retry, while TwiPay records no
      // unverified payload as trusted financial evidence.
      throw new UnauthorizedException({ code: 'WEBHOOK_VERIFICATION_FAILED' });
    }
    const dedup = deduplicationKey(providerCode, verified.eventType, verified.externalEventId, verified.payloadHash);
    const recoveryPayload = sealRecoveryPayload(verified, process.env['DATA_ENCRYPTION_KEY']!);

    let event = await this.prisma.webhookEvent.findUnique({
      where: { providerCode_deduplicationKey: { providerCode, deduplicationKey: dedup } },
    });

    if (!event) {
      try {
        event = await this.prisma.webhookEvent.create({
          data: {
            providerCode,
            deduplicationKey: dedup,
            externalEventId: verified.externalEventId,
            eventType: verified.eventType,
            merchantReference: verified.merchantReference,
            providerReference: verified.providerReference,
            payloadHash: verified.payloadHash,
            status: 'VERIFIED',
            ...(recoveryPayload ? { recoveryPayloadCiphertext: recoveryPayload } : {}),
            normalizedPayload: {
              eventType: verified.eventType,
              merchantReference: verified.merchantReference ?? null,
              providerReference: verified.providerReference ?? null,
              status: verified.status ?? null,
            },
          },
        });
      } catch (error) {
        event = await this.prisma.webhookEvent.findUnique({
          where: { providerCode_deduplicationKey: { providerCode, deduplicationKey: dedup } },
        });
        if (!event) throw error;
      }
    }

    if (event.status === 'PROCESSED' || event.status === 'IGNORED') {
      return { accepted: true, duplicate: true };
    }
    // A live claim is left alone. A claim whose process died is taken over by this delivery, which carries the full payload.
    if (event.status === 'PROCESSING' && Date.now() - claimStartedAt(event).getTime() < STALE_WEBHOOK_CLAIM_MS) {
      return { accepted: true, duplicate: true, processing: true };
    }

    // Claim VERIFIED/FAILED deliveries atomically. This permits a provider retry
    // to recover a prior local processing failure while preventing two workers
    // from processing the same event concurrently.
    const claimed = event.status === 'PROCESSING'
      ? await this.claimStale(event)
      : await this.prisma.webhookEvent.updateMany({
        where: { id: event.id, status: { in: ['VERIFIED', 'FAILED'] } },
        data: { status: 'PROCESSING', processingStartedAt: new Date(), failureCode: null },
      }).then((result) => result.count === 1);
    if (!claimed) return { accepted: true, duplicate: true, processing: true };

    try {
      await this.processVerified(providerCode, verified);
      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: { status: 'PROCESSED', processedAt: new Date(), failureCode: null, recoveryPayloadCiphertext: null },
      });
      return { accepted: true, duplicate: false };
    } catch (error) {
      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          status: 'FAILED',
          failureCode: error instanceof Error ? error.message.slice(0, 100) : 'WEBHOOK_PROCESSING_FAILED',
        },
      });
      throw error;
    }
  }

  /**
   * Re-processes events whose handling died part-way (ISS-017): VERIFIED or PROCESSING for longer than STALE_WEBHOOK_CLAIM_MS.
   * Handlers requery the provider and run under row locks and terminal-state checks, so running one again is the same thing a
   * provider redelivery of a FAILED event already does. The stored row was written only after signature verification, so the
   * signature is not checked again. Returns how many events were recovered.
   */
  async recoverStale(limit = 25, now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - STALE_WEBHOOK_CLAIM_MS);
    const rows = await this.prisma.webhookEvent.findMany({
      where: {
        OR: [
          { status: 'PROCESSING', processingStartedAt: { lt: cutoff } },
          { status: 'PROCESSING', processingStartedAt: null, receivedAt: { lt: cutoff } },
          { status: 'VERIFIED', receivedAt: { lt: cutoff } },
        ],
      },
      orderBy: { receivedAt: 'asc' },
      take: limit,
    });

    let recovered = 0;
    for (const row of rows) {
      if (row.providerCode !== 'paystack' && row.providerCode !== 'monnify') continue;
      if (!(await this.claimStale(row))) continue; // another sweep or a redelivery got there first
      try {
        const restored = row.recoveryPayloadCiphertext ? openRecoveryPayload(row.recoveryPayloadCiphertext, process.env['DATA_ENCRYPTION_KEY']!) : {};
        const handled = await this.processVerified(row.providerCode, { ...(row.merchantReference ? { merchantReference: row.merchantReference } : {}), ...restored });
        if (!handled && !row.recoveryPayloadCiphertext) {
          // Nothing could be done from stored data. Events from before the recovery payload existed may have been virtual-account
          // credits; marking them PROCESSED would drop a deposit without a trace. FAILED keeps them visible and lets the
          // provider's redelivery (which carries the full payload) run them.
          await this.prisma.webhookEvent.update({ where: { id: row.id }, data: { status: 'FAILED', failureCode: 'WEBHOOK_RECOVERY_PAYLOAD_MISSING' } });
          continue;
        }
        await this.prisma.webhookEvent.update({ where: { id: row.id }, data: { status: 'PROCESSED', processedAt: new Date(), failureCode: null, recoveryPayloadCiphertext: null } });
        recovered += 1;
      } catch (error) {
        await this.prisma.webhookEvent.update({
          where: { id: row.id },
          data: { status: 'FAILED', failureCode: error instanceof Error ? error.message.slice(0, 100) : 'WEBHOOK_PROCESSING_FAILED' },
        });
      }
    }
    return recovered;
  }

  /** Takes a claim over only if the row is still exactly as it was read, so two takers cannot both win. */
  private async claimStale(event: ClaimableEvent): Promise<boolean> {
    const result = await this.prisma.webhookEvent.updateMany({
      where: event.status === 'PROCESSING'
        ? { id: event.id, status: 'PROCESSING', processingStartedAt: event.processingStartedAt }
        : { id: event.id, status: 'VERIFIED' },
      data: { status: 'PROCESSING', processingStartedAt: new Date(), failureCode: null },
    });
    return result.count === 1;
  }

  /** Returns whether the delivery matched anything this service knows how to apply. */
  private async processVerified(providerCode: EnabledPaymentProvider, verified: RecoverableWebhook): Promise<boolean> {
    let handled = false;
    if (verified.virtualAccountAssignment) {
      await this.virtualAccounts.applyProviderAssignment(providerCode, verified.virtualAccountAssignment);
      handled = true;
    }
    if (verified.virtualAccountCredit) {
      await this.payments.verifyAndSettleVirtualAccountCredit(providerCode, verified.virtualAccountCredit);
      handled = true;
    }
    if (!verified.merchantReference) return handled;

    const operation = await this.prisma.providerOperation.findUnique({
      where: { providerCode_merchantReference: { providerCode, merchantReference: verified.merchantReference } },
      select: { type: true },
    });
    if (operation?.type === 'COLLECTION') {
      await this.payments.verifyAndSettleCollection(providerCode, verified.merchantReference);
      handled = true;
    } else if (operation?.type === 'PAYOUT') {
      await this.transfers.verifyAndApplyPayout(providerCode, verified.merchantReference);
      handled = true;
    }
    return handled;
  }
}
