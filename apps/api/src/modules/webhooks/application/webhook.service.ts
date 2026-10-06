import { createHash } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { RawWebhookRequest, VerifiedWebhook } from '@twipay/contracts';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { PaymentProviderRegistry, type EnabledPaymentProvider } from '../../providers/payment-provider.registry.js';
import { PaymentService } from '../../finance/application/payment.service.js';
import { TransferService } from '../../finance/application/transfer.service.js';
import { VirtualAccountService } from '../../finance/application/virtual-account.service.js';

function deduplicationKey(provider: string, eventType: string, externalId: string | undefined, payloadHash: string): string {
  return createHash('sha256').update(`${provider}|${eventType}|${externalId ?? payloadHash}`).digest('hex');
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
    if (event.status === 'PROCESSING') {
      return { accepted: true, duplicate: true, processing: true };
    }

    // Claim VERIFIED/FAILED deliveries atomically. This permits a provider retry
    // to recover a prior local processing failure while preventing two workers
    // from processing the same event concurrently.
    const claimed = await this.prisma.webhookEvent.updateMany({
      where: { id: event.id, status: { in: ['VERIFIED', 'FAILED'] } },
      data: { status: 'PROCESSING', failureCode: null },
    });
    if (claimed.count !== 1) return { accepted: true, duplicate: true, processing: true };

    try {
      await this.processVerified(providerCode, verified);
      await this.prisma.webhookEvent.update({
        where: { id: event.id },
        data: { status: 'PROCESSED', processedAt: new Date(), failureCode: null },
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

  private async processVerified(providerCode: EnabledPaymentProvider, verified: VerifiedWebhook): Promise<void> {
    if (verified.virtualAccountAssignment) {
      await this.virtualAccounts.applyProviderAssignment(providerCode, verified.virtualAccountAssignment);
    }
    if (verified.virtualAccountCredit) {
      await this.payments.verifyAndSettleVirtualAccountCredit(providerCode, verified.virtualAccountCredit);
    }
    if (!verified.merchantReference) return;

    const operation = await this.prisma.providerOperation.findUnique({
      where: { providerCode_merchantReference: { providerCode, merchantReference: verified.merchantReference } },
      select: { type: true },
    });
    if (operation?.type === 'COLLECTION') {
      await this.payments.verifyAndSettleCollection(providerCode, verified.merchantReference);
    } else if (operation?.type === 'PAYOUT') {
      await this.transfers.verifyAndApplyPayout(providerCode, verified.merchantReference);
    }
  }
}
