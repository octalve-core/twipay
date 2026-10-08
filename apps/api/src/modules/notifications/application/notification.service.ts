import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { NotificationChannel, NotificationProviderPort } from '@twipay/contracts';
import { decryptSensitiveString, encryptSensitiveString, fingerprintSensitiveValue } from '@twipay/security';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { NotificationProviderRegistry } from '../../providers/notification-provider.registry.js';


function notificationRetryPolicy(): { maxAttempts: number; retryDelayMs: number; processingStaleMs: number } {
  const maxAttempts = Number(process.env['NOTIFICATION_MAX_ATTEMPTS'] ?? '5');
  const retryDelayMs = Number(process.env['NOTIFICATION_RETRY_DELAY_MS'] ?? '60000');
  const processingStaleMs = Number(process.env['NOTIFICATION_PROCESSING_STALE_MS'] ?? '300000');
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) throw new Error('INVALID_NOTIFICATION_MAX_ATTEMPTS');
  if (!Number.isInteger(retryDelayMs) || retryDelayMs < 10000 || retryDelayMs > 3600000) throw new Error('INVALID_NOTIFICATION_RETRY_DELAY_MS');
  if (!Number.isInteger(processingStaleMs) || processingStaleMs < 60000 || processingStaleMs > 86400000) throw new Error('INVALID_NOTIFICATION_PROCESSING_STALE_MS');
  return { maxAttempts, retryDelayMs, processingStaleMs };
}

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService, private readonly providers: NotificationProviderRegistry) {}

  /** Owner-scoped delivery metadata; sensitive destination and encrypted body are intentionally excluded. */
  async listDeliveryHistory(userId: string) {
    const rows = await this.prisma.notification.findMany({
      where: { userId }, orderBy: { createdAt: 'desc' }, take: 100,
      select: { id: true, templateCode: true, subject: true, channel: true, status: true, createdAt: true, updatedAt: true },
    });
    return rows.map((n) => ({ id: n.id, title: n.subject ?? n.templateCode.replaceAll('_', ' '), templateCode: n.templateCode, channel: n.channel, deliveryStatus: n.status, createdAt: n.createdAt, updatedAt: n.updatedAt }));
  }

  async enqueue(input: {
    userId?: string;
    channel: NotificationChannel;
    templateCode: string;
    destination: string;
    subject?: string;
    text: string;
    idempotencyKey: string;
  }) {
    return this.prisma.$transaction((tx) => this.enqueueWithTx(tx, input));
  }

  async enqueueWithTx(tx: Prisma.TransactionClient, input: {
    userId?: string;
    channel: NotificationChannel;
    templateCode: string;
    destination: string;
    subject?: string;
    text: string;
    idempotencyKey: string;
  }) {
    const existing = await tx.notification.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return existing;
    return tx.notification.create({
      data: {
        ...(input.userId ? { userId: input.userId } : {}),
        channel: input.channel,
        templateCode: input.templateCode,
        destinationCiphertext: encryptSensitiveString(input.destination, process.env['DATA_ENCRYPTION_KEY']!),
        destinationFingerprint: fingerprintSensitiveValue(input.destination.trim().toLowerCase(), process.env['PII_FINGERPRINT_KEY']!),
        destinationLast4: input.destination.slice(-4),
        ...(input.subject ? { subject: input.subject } : {}),
        bodyCiphertext: encryptSensitiveString(input.text, process.env['DATA_ENCRYPTION_KEY']!),
        idempotencyKey: input.idempotencyKey,
      },
    });
  }

  async deliver(notificationId: string): Promise<void> {
    const existing = await this.prisma.notification.findUnique({ where: { id: notificationId }, select: { channel: true } });
    if (!existing) return;
    let provider: NotificationProviderPort;
    try { provider = this.providers.get(existing.channel); } catch { return; }
    const policy = notificationRetryPolicy();
    const notification = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "notifications" WHERE "id" = ${notificationId}::uuid FOR UPDATE SKIP LOCKED
      `;
      if (!locked[0]) return null;
      const current = await tx.notification.findUniqueOrThrow({ where: { id: notificationId } });
      if (['ACCEPTED', 'DELIVERED'].includes(current.status)) return null;
      if (current.status === 'PROCESSING' && Date.now() - current.updatedAt.getTime() < policy.processingStaleMs) return null;
      return tx.notification.update({ where: { id: current.id }, data: { status: 'PROCESSING' } });
    });
    if (!notification) return;

    const destination = decryptSensitiveString(notification.destinationCiphertext, process.env['DATA_ENCRYPTION_KEY']!);
    const text = decryptSensitiveString(notification.bodyCiphertext, process.env['DATA_ENCRYPTION_KEY']!);
    try {
      const result = await provider.send({
        channel: notification.channel,
        destination,
        ...(notification.subject ? { subject: notification.subject } : {}),
        text,
        idempotencyKey: notification.idempotencyKey,
      });
      const status = result.status === 'DELIVERED' ? 'DELIVERED'
        : result.status === 'ACCEPTED' ? 'ACCEPTED'
          : result.status === 'FAILED' ? 'FAILED' : 'UNKNOWN';
      await this.prisma.$transaction([
        this.prisma.notification.update({ where: { id: notification.id }, data: { status } }),
        this.prisma.notificationAttempt.create({
          data: {
            notificationId: notification.id,
            providerCode: result.providerCode,
            providerReference: result.providerReference ?? null,
            status,
            failureCode: status === 'FAILED' ? (result.rawStatus ?? 'PROVIDER_REJECTED') : null,
          },
        }),
      ]);
    } catch (error) {
      await this.prisma.$transaction([
        this.prisma.notification.update({ where: { id: notification.id }, data: { status: 'UNKNOWN' } }),
        this.prisma.notificationAttempt.create({
          data: { notificationId: notification.id, providerCode: provider.code, status: 'UNKNOWN', failureCode: 'PROVIDER_OUTCOME_UNKNOWN' },
        }),
      ]);
    }
  }

  async enqueueAndAttempt(input: Parameters<NotificationService['enqueue']>[0]): Promise<void> {
    const notification = await this.enqueue(input);
    await this.deliver(notification.id);
  }

  async processPending(limit = 25): Promise<number> {
    const policy = notificationRetryPolicy();
    const rows = await this.prisma.notification.findMany({
      where: { status: { in: ['PENDING', 'UNKNOWN', 'FAILED', 'PROCESSING'] } },
      orderBy: { createdAt: 'asc' },
      take: Math.min(Math.max(limit * 3, limit), 300),
      include: { attempts: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });
    let processed = 0;
    for (const row of rows) {
      if (processed >= Math.min(Math.max(limit, 1), 100)) break;
      const totalAttempts = await this.prisma.notificationAttempt.count({ where: { notificationId: row.id } });
      if (totalAttempts >= policy.maxAttempts) continue;
      const lastAttempt = row.attempts[0]?.createdAt;
      if (row.status === 'PROCESSING' && Date.now() - row.updatedAt.getTime() < policy.processingStaleMs) continue;
      if (row.status !== 'PENDING' && row.status !== 'PROCESSING' && lastAttempt && Date.now() - lastAttempt.getTime() < policy.retryDelayMs) continue;
      await this.deliver(row.id);
      processed += 1;
    }
    return processed;
  }
}
