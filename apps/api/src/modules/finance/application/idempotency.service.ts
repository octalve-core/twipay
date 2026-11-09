import { createHash } from 'node:crypto';
import { ConflictException, Injectable } from '@nestjs/common';
import type { JsonObject, JsonValue } from '@twipay/contracts';
import { decryptSensitiveString, encryptSensitiveString } from '@twipay/security';
import { validateIdempotencyKey } from '@twipay/ledger';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../platform/database/prisma.service.js';

function canonical(value: unknown): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Non-finite request value');
    return value;
  }
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const out: Record<string, JsonValue> = {};
    for (const key of Object.keys(source).sort()) {
      if (source[key] !== undefined) out[key] = canonical(source[key]);
    }
    return out;
  }
  throw new Error('Unsupported request value for idempotency hashing');
}

function requestHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

/**
 * A request holding a key without having committed anything (no resource attached) cannot legitimately run this long: every
 * caller is bounded by the provider timeout and the platform's request limit. Past this age the holder is considered dead.
 */
export const STALE_PROCESSING_MS = 5 * 60 * 1000;

export interface IdempotencyStart {
  recordId?: string;
  replay?: { status: number; body: JsonObject };
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `reclaimStale` is opt-in per caller. When set, a key left in PROCESSING with no resource attached for longer than
   * STALE_PROCESSING_MS (the process died between `begin` and the first durable write) is released and claimed again instead of
   * answering 409 until the TTL passes. Only pass it for flows whose steps before `attachResource` have no side effect that a
   * second run would repeat (for example a one-time code sent to a provider).
   */
  async begin(input: { scope: string; key: string; userId: string; request: unknown; ttlHours?: number; reclaimStale?: boolean }): Promise<IdempotencyStart> {
    return this.beginOnce(input, input.reclaimStale === true);
  }

  private async beginOnce(input: { scope: string; key: string; userId: string; request: unknown; ttlHours?: number }, mayReclaim: boolean): Promise<IdempotencyStart> {
    const key = validateIdempotencyKey(input.key);
    const hash = requestHash(input.request);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (input.ttlHours ?? 24) * 60 * 60 * 1000);

    // Expired keys may be reused, but stale rows must be removed before the
    // unique insert. Concurrent callers remain protected by the database
    // uniqueness constraint and the conflict/replay path below.
    await this.prisma.idempotencyRecord.deleteMany({
      where: { userId: input.userId, scope: input.scope, key, expiresAt: { lte: now } },
    });

    try {
      const record = await this.prisma.idempotencyRecord.create({
        data: {
          scope: input.scope,
          key,
          requestHash: hash,
          expiresAt,
          userId: input.userId,
        },
        select: { id: true },
      });
      return { recordId: record.id };
    } catch (error) {
      const existing = await this.prisma.idempotencyRecord.findUnique({
        where: { userId_scope_key: { userId: input.userId, scope: input.scope, key } },
      });
      if (!existing) throw error;
      if (existing.requestHash !== hash) {
        throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST' });
      }
      if (existing.status === 'PROCESSING') {
        if (mayReclaim && existing.resourceId === null && now.getTime() - existing.createdAt.getTime() >= STALE_PROCESSING_MS) {
          // Same guard as releaseProcessing: the delete only matches while nothing durable has been attached.
          const released = await this.prisma.idempotencyRecord.deleteMany({ where: { id: existing.id, status: 'PROCESSING', resourceId: null } });
          if (released.count === 1) return this.beginOnce(input, false);
        }
        throw new ConflictException({ code: 'IDEMPOTENCY_REQUEST_IN_PROGRESS' });
      }
      const body = existing.responseBodyCiphertext
        ? JSON.parse(decryptSensitiveString(existing.responseBodyCiphertext, process.env['DATA_ENCRYPTION_KEY']!)) as JsonObject
        : {};
      return { replay: { status: existing.responseStatus ?? (existing.status === 'COMPLETED' ? 200 : 409), body } };
    }
  }

  async attachResource(recordId: string, resourceType: string, resourceId: string): Promise<void> {
    await this.prisma.idempotencyRecord.update({ where: { id: recordId }, data: { resourceType, resourceId } });
  }

  async attachResourceWithTx(tx: Prisma.TransactionClient, recordId: string, resourceType: string, resourceId: string): Promise<void> {
    await tx.idempotencyRecord.update({ where: { id: recordId }, data: { resourceType, resourceId } });
  }

  async completeWithTx(tx: Prisma.TransactionClient, recordId: string, responseStatus: number, responseBody: JsonObject): Promise<void> {
    await tx.idempotencyRecord.update({
      where: { id: recordId },
      data: {
        status: 'COMPLETED',
        responseStatus,
        responseBodyCiphertext: encryptSensitiveString(JSON.stringify(responseBody), process.env['DATA_ENCRYPTION_KEY']!),
      },
    });
  }

  async complete(recordId: string, responseStatus: number, responseBody: JsonObject): Promise<void> {
    await this.prisma.idempotencyRecord.update({
      where: { id: recordId },
      data: {
        status: 'COMPLETED',
        responseStatus,
        responseBodyCiphertext: encryptSensitiveString(JSON.stringify(responseBody), process.env['DATA_ENCRYPTION_KEY']!),
      },
    });
  }

  async fail(recordId: string, responseStatus: number, responseBody: JsonObject): Promise<void> {
    await this.prisma.idempotencyRecord.update({
      where: { id: recordId },
      data: {
        status: 'FAILED',
        responseStatus,
        responseBodyCiphertext: encryptSensitiveString(JSON.stringify(responseBody), process.env['DATA_ENCRYPTION_KEY']!),
      },
    });
  }

  /**
   * Releases an idempotency key only while no durable result/resource has been
   * committed. This is used for transient pre-commit failures so a network or
   * database outage does not poison a client key for the full TTL.
   */
  async releaseProcessing(recordId: string): Promise<void> {
    await this.prisma.idempotencyRecord.deleteMany({
      where: { id: recordId, status: 'PROCESSING', resourceId: null },
    });
  }

  /**
   * Removes records whose TTL has passed. `begin` only deletes an expired row when the same key is used again, so without this
   * the table grows for ever. Bounded per call so one sweep never holds a long delete.
   */
  async purgeExpired(limit = 500, now = new Date()): Promise<number> {
    const rows = await this.prisma.idempotencyRecord.findMany({ where: { expiresAt: { lte: now } }, select: { id: true }, take: limit, orderBy: { expiresAt: 'asc' } });
    if (rows.length === 0) return 0;
    const deleted = await this.prisma.idempotencyRecord.deleteMany({ where: { id: { in: rows.map((row) => row.id) }, expiresAt: { lte: now } } });
    return deleted.count;
  }
}
