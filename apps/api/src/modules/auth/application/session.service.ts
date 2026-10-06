import { createHmac, randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { SESSION_TTL_SECONDS } from '@twipay/security';

function hash(value: string, pepper: string): string {
  return createHmac('sha256', pepper).update(value).digest('hex');
}

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  private pepper(): string {
    const value = process.env.SESSION_HASH_PEPPER;
    if (!value || value.length < 32) throw new Error('SESSION_HASH_PEPPER must be configured with at least 32 characters');
    return value;
  }

  async create(userId: string, userAgent?: string, ip?: string) {
    const token = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(32).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000);
    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash: hash(token, this.pepper()),
        csrfTokenHash: hash(csrfToken, this.pepper()),
        ...(userAgent ? { userAgent: userAgent.slice(0, 512) } : {}),
        ...(ip ? { ipHash: hash(ip, this.pepper()) } : {}),
        expiresAt,
      },
      select: { id: true, expiresAt: true },
    });
    return { sessionId: session.id, token, csrfToken, expiresAt: session.expiresAt };
  }

  async resolve(token: string) {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hash(token, this.pepper()) },
      include: { user: { include: { roleAssignments: { include: { role: true } } } } },
    });
    if (!session || session.status !== 'ACTIVE' || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') throw new UnauthorizedException();
    return session;
  }

  async verifyCsrf(sessionId: string, csrfToken: string): Promise<void> {
    const session = await this.prisma.session.findUnique({ where: { id: sessionId }, select: { csrfTokenHash: true } });
    if (!session || hash(csrfToken, this.pepper()) !== session.csrfTokenHash) throw new UnauthorizedException('Invalid CSRF token');
  }

  async rotateCsrf(token: string): Promise<string> {
    const session = await this.resolve(token);
    const csrfToken = randomBytes(32).toString('base64url');
    await this.prisma.session.update({
      where: { id: session.id },
      data: { csrfTokenHash: hash(csrfToken, this.pepper()), lastSeenAt: new Date() },
    });
    return csrfToken;
  }

  async revokeByToken(token: string, reason = 'LOGOUT'): Promise<void> {
    await this.prisma.session.updateMany({
      where: { tokenHash: hash(token, this.pepper()), status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: new Date(), revokeReason: reason },
    });
  }
}
