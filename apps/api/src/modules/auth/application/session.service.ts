import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  SESSION_IDLE_TTL_SECONDS,
  SESSION_TTL_SECONDS,
} from '@twipay/security';
import { PrismaService } from '../../../platform/database/prisma.service.js';

function hash(value: string, pepper: string): string {
  return createHmac('sha256', pepper).update(value).digest('hex');
}

function safeEqualHex(left: string, right: string): boolean {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

function positiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

export interface SessionMaterial {
  sessionId: string;
  token: string;
  csrfToken: string;
  expiresAt: Date;
}

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  private pepper(): string {
    const value = process.env['SESSION_HASH_PEPPER'];
    if (!value || value.length < 32) throw new Error('SESSION_HASH_PEPPER must be configured with at least 32 characters');
    return value;
  }

  private absoluteTtlSeconds(): number {
    return positiveIntEnv('SESSION_ABSOLUTE_TTL_SECONDS', SESSION_TTL_SECONDS);
  }

  private idleTtlSeconds(): number {
    return positiveIntEnv('SESSION_IDLE_TTL_SECONDS', SESSION_IDLE_TTL_SECONDS);
  }

  private touchIntervalSeconds(): number {
    return positiveIntEnv('SESSION_TOUCH_INTERVAL_SECONDS', 300);
  }

  private createMaterial() {
    const token = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(32).toString('base64url');
    return { token, csrfToken, tokenHash: hash(token, this.pepper()), csrfTokenHash: hash(csrfToken, this.pepper()) };
  }

  async create(userId: string, userAgent?: string, ip?: string, mfaSatisfiedAt?: Date | null): Promise<SessionMaterial> {
    const material = this.createMaterial();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.absoluteTtlSeconds() * 1000);
    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash: material.tokenHash,
        csrfTokenHash: material.csrfTokenHash,
        ...(userAgent ? { userAgent: userAgent.slice(0, 512) } : {}),
        ...(ip ? { ipHash: hash(ip, this.pepper()) } : {}),
        ...(mfaSatisfiedAt ? { mfaSatisfiedAt } : {}),
        expiresAt,
      },
      select: { id: true, expiresAt: true },
    });
    return { sessionId: session.id, token: material.token, csrfToken: material.csrfToken, expiresAt: session.expiresAt };
  }

  async resolve(token: string) {
    const now = new Date();
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hash(token, this.pepper()) },
      include: { user: { include: { roleAssignments: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } } },
    });
    if (!session || session.status !== 'ACTIVE') throw new UnauthorizedException({ code: 'AUTHENTICATION_REQUIRED' });

    if (session.expiresAt <= now) {
      await this.expireSession(session.id, session.userId, 'ABSOLUTE_TTL_EXPIRED');
      throw new UnauthorizedException({ code: 'SESSION_EXPIRED' });
    }

    const idleCutoff = new Date(now.getTime() - this.idleTtlSeconds() * 1000);
    if (session.lastSeenAt <= idleCutoff) {
      await this.expireSession(session.id, session.userId, 'IDLE_TTL_EXPIRED');
      throw new UnauthorizedException({ code: 'SESSION_IDLE_EXPIRED' });
    }

    if (session.user.status !== 'ACTIVE') {
      await this.endActiveSession(session.id, session.userId, 'REVOKED', 'USER_INACTIVE');
      throw new UnauthorizedException({ code: 'AUTHENTICATION_REQUIRED' });
    }

    const touchCutoff = new Date(now.getTime() - this.touchIntervalSeconds() * 1000);
    if (session.lastSeenAt <= touchCutoff) {
      const touched = await this.prisma.session.updateMany({
        where: { id: session.id, status: 'ACTIVE', expiresAt: { gt: now }, lastSeenAt: { gt: idleCutoff, lte: touchCutoff } },
        data: { lastSeenAt: now },
      });
      if (touched.count !== 1) throw new UnauthorizedException({ code: 'AUTHENTICATION_REQUIRED' });
      session.lastSeenAt = now;
    }
    return session;
  }

  async verifyCsrf(sessionId: string, csrfToken: string): Promise<void> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId }, select: { csrfTokenHash: true, status: true } });
    const candidate = hash(csrfToken, this.pepper());
    if (!session || session.status !== 'ACTIVE' || !safeEqualHex(candidate, session.csrfTokenHash)) {
      throw new UnauthorizedException({ code: 'CSRF_INVALID' });
    }
  }

  async rotateCsrf(token: string): Promise<string> {
    const session = await this.resolve(token);
    const csrfToken = randomBytes(32).toString('base64url');
    const now = new Date();
    const updated = await this.prisma.session.updateMany({
      where: { id: session.id, status: 'ACTIVE', expiresAt: { gt: now }, lastSeenAt: { gt: new Date(now.getTime() - this.idleTtlSeconds() * 1000) } },
      data: { csrfTokenHash: hash(csrfToken, this.pepper()), lastSeenAt: now },
    });
    if (updated.count !== 1) throw new UnauthorizedException({ code: 'AUTHENTICATION_REQUIRED' });
    return csrfToken;
  }

  /**
   * Security-sensitive transitions receive a brand-new opaque session token.
   * The original absolute expiry is retained so repeated rotation cannot extend
   * a login indefinitely. The old/pre-MFA token is revoked before the new token
   * becomes usable outside this transaction.
   */
  async rotate(sessionId: string, input: { mfaSatisfiedAt: Date | null; reason: string }): Promise<SessionMaterial> {
    const material = this.createMaterial();
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.session.findUnique({
        where: { id: sessionId },
        select: { id: true, userId: true, status: true, userAgent: true, ipHash: true, expiresAt: true, lastSeenAt: true, user: { select: { status: true } } },
      });
      if (!current || current.status !== 'ACTIVE' || current.user.status !== 'ACTIVE' || current.expiresAt <= now) throw new UnauthorizedException({ code: 'AUTHENTICATION_REQUIRED' });
      if (current.lastSeenAt <= new Date(now.getTime() - this.idleTtlSeconds() * 1000)) throw new UnauthorizedException({ code: 'SESSION_IDLE_EXPIRED' });

      // Compare-and-set: concurrent rotations/logouts must not mint two replacements.
      const revoked = await tx.session.updateMany({
        where: { id: current.id, status: 'ACTIVE', expiresAt: { gt: now }, lastSeenAt: { gt: new Date(now.getTime() - this.idleTtlSeconds() * 1000) } },
        data: { status: 'REVOKED', revokedAt: now, revokeReason: input.reason },
      });
      if (revoked.count !== 1) throw new UnauthorizedException({ code: 'AUTHENTICATION_REQUIRED' });
      const replacement = await tx.session.create({
        data: {
          userId: current.userId,
          tokenHash: material.tokenHash,
          csrfTokenHash: material.csrfTokenHash,
          userAgent: current.userAgent,
          ipHash: current.ipHash,
          mfaSatisfiedAt: input.mfaSatisfiedAt,
          lastSeenAt: now,
          expiresAt: current.expiresAt,
        },
        select: { id: true, userId: true, expiresAt: true },
      });
      await tx.securityEvent.create({
        data: { userId: current.userId, type: 'SESSION_ROTATED', metadata: { reason: input.reason, oldSessionId: current.id, newSessionId: replacement.id } },
      });
      return replacement;
    });
    return { sessionId: result.id, token: material.token, csrfToken: material.csrfToken, expiresAt: result.expiresAt };
  }

  async revokeOtherUserSessions(userId: string, exceptSessionId: string, reason: string): Promise<number> {
    const now = new Date();
    const result = await this.prisma.session.updateMany({
      where: { userId, status: 'ACTIVE', id: { not: exceptSessionId } },
      data: { status: 'REVOKED', revokedAt: now, revokeReason: reason },
    });
    if (result.count > 0) {
      await this.prisma.securityEvent.create({ data: { userId, type: 'SESSION_REVOKED', metadata: { reason, count: result.count } } });
    }
    return result.count;
  }

  async revokeByToken(token: string, reason = 'LOGOUT'): Promise<void> {
    const tokenHash = hash(token, this.pepper());
    const session = await this.prisma.session.findUnique({ where: { tokenHash }, select: { id: true, userId: true, status: true } });
    if (!session || session.status !== 'ACTIVE') return;
    const now = new Date();
    const result = await this.prisma.session.updateMany({
      where: { id: session.id, status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: now, revokeReason: reason },
    });
    if (result.count > 0) {
      await this.prisma.securityEvent.create({
        data: { userId: session.userId, type: reason === 'LOGOUT' ? 'LOGOUT' : 'SESSION_REVOKED', metadata: { reason, sessionId: session.id } },
      });
    }
  }

  private async expireSession(sessionId: string, userId: string, reason: 'ABSOLUTE_TTL_EXPIRED' | 'IDLE_TTL_EXPIRED'): Promise<void> {
    await this.endActiveSession(sessionId, userId, 'EXPIRED', reason);
  }

  private async endActiveSession(sessionId: string, userId: string, status: 'REVOKED' | 'EXPIRED', reason: string): Promise<void> {
    const now = new Date();
    const result = await this.prisma.session.updateMany({
      where: { id: sessionId, status: 'ACTIVE' },
      data: { status, revokedAt: now, revokeReason: reason },
    });
    if (result.count > 0) {
      await this.prisma.securityEvent.create({
        data: { userId, type: status === 'EXPIRED' ? 'SESSION_EXPIRED' : 'SESSION_REVOKED', metadata: { reason, sessionId } },
      });
    }
  }
}
