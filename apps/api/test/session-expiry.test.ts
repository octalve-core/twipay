import { UnauthorizedException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionService } from '../src/modules/auth/application/session.service.js';

const NOW = new Date('2026-10-08T08:00:00.000Z');
const PEPPER = 'batch5-session-test-pepper-0123456789abcdef';

function activeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    userId: 'user-1',
    status: 'ACTIVE',
    expiresAt: new Date(NOW.getTime() + 60_000),
    lastSeenAt: new Date(NOW.getTime() - 30_000),
    userAgent: 'test-agent',
    ipHash: 'ip-hash',
    mfaSatisfiedAt: null,
    csrfTokenHash: '0'.repeat(64),
    user: { id: 'user-1', status: 'ACTIVE', roleAssignments: [] },
    ...overrides,
  };
}

function fakePrisma(session: ReturnType<typeof activeSession>) {
  const securityEvents: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];
  const createdSessions: Array<Record<string, unknown>> = [];

  const prisma = {
    session: {
      findUnique: vi.fn(async () => session),
      updateMany: vi.fn(async (args: Record<string, unknown>) => {
        updates.push(args);
        return { count: 1 };
      }),
      update: vi.fn(async (args: Record<string, unknown>) => {
        updates.push(args);
        return session;
      }),
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        createdSessions.push(args.data);
        return { id: 'session-2', userId: session.userId, expiresAt: args.data['expiresAt'] as Date };
      }),
    },
    securityEvent: {
      create: vi.fn(async (args: { data: Record<string, unknown> }) => {
        securityEvents.push(args.data);
        return args.data;
      }),
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)),
  };

  return { prisma, securityEvents, updates, createdSessions };
}

describe('SessionService runtime expiry and rotation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    process.env['SESSION_HASH_PEPPER'] = PEPPER;
    process.env['SESSION_IDLE_TTL_SECONDS'] = '60';
    process.env['SESSION_ABSOLUTE_TTL_SECONDS'] = '3600';
    process.env['SESSION_TOUCH_INTERVAL_SECONDS'] = '300';
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env['SESSION_HASH_PEPPER'];
    delete process.env['SESSION_IDLE_TTL_SECONDS'];
    delete process.env['SESSION_ABSOLUTE_TTL_SECONDS'];
    delete process.env['SESSION_TOUCH_INTERVAL_SECONDS'];
  });

  it('expires an idle session at runtime and records an auditable reason', async () => {
    const fixture = fakePrisma(activeSession({ lastSeenAt: new Date(NOW.getTime() - 61_000) }));
    const service = new SessionService(fixture.prisma as never);

    await expect(service.resolve('opaque-token')).rejects.toMatchObject({
      response: { code: 'SESSION_IDLE_EXPIRED' },
    });
    expect(fixture.updates.at(-1)).toMatchObject({
      data: { status: 'EXPIRED', revokeReason: 'IDLE_TTL_EXPIRED' },
    });
    expect(fixture.securityEvents.at(-1)).toMatchObject({
      type: 'SESSION_EXPIRED',
      metadata: { reason: 'IDLE_TTL_EXPIRED', sessionId: 'session-1' },
    });
  });

  it('expires an absolutely expired session before considering idle state', async () => {
    const fixture = fakePrisma(activeSession({
      expiresAt: new Date(NOW.getTime() - 1),
      lastSeenAt: new Date(NOW.getTime() - 61_000),
    }));
    const service = new SessionService(fixture.prisma as never);

    await expect(service.resolve('opaque-token')).rejects.toMatchObject({
      response: { code: 'SESSION_EXPIRED' },
    });
    expect(fixture.updates.at(-1)).toMatchObject({
      data: { status: 'EXPIRED', revokeReason: 'ABSOLUTE_TTL_EXPIRED' },
    });
  });

  it('rotates a security-sensitive session without extending its absolute lifetime', async () => {
    const originalExpiry = new Date(NOW.getTime() + 120_000);
    const fixture = fakePrisma(activeSession({ expiresAt: originalExpiry }));
    const service = new SessionService(fixture.prisma as never);

    const replacement = await service.rotate('session-1', { mfaSatisfiedAt: NOW, reason: 'MFA_STEP_UP' });

    expect(replacement.sessionId).toBe('session-2');
    expect(replacement.expiresAt).toEqual(originalExpiry);
    expect(replacement.token).not.toHaveLength(0);
    expect(replacement.csrfToken).not.toHaveLength(0);
    expect(fixture.updates[0]).toMatchObject({
      data: { status: 'REVOKED', revokeReason: 'MFA_STEP_UP' },
    });
    expect(fixture.createdSessions[0]).toMatchObject({
      userId: 'user-1',
      mfaSatisfiedAt: NOW,
      expiresAt: originalExpiry,
    });
    expect(fixture.securityEvents.at(-1)).toMatchObject({
      type: 'SESSION_ROTATED',
      metadata: { reason: 'MFA_STEP_UP', oldSessionId: 'session-1', newSessionId: 'session-2' },
    });
  });

  it('rejects rotating an already idle session so a stale token cannot be refreshed by step-up', async () => {
    const fixture = fakePrisma(activeSession({ lastSeenAt: new Date(NOW.getTime() - 61_000) }));
    const service = new SessionService(fixture.prisma as never);

    await expect(service.rotate('session-1', { mfaSatisfiedAt: NOW, reason: 'MFA_STEP_UP' }))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(fixture.createdSessions).toHaveLength(0);
  });

  it('rejects rotation when a concurrent logout has claimed the active session', async () => {
    const fixture = fakePrisma(activeSession());
    fixture.prisma.session.updateMany.mockResolvedValueOnce({ count: 0 });
    const service = new SessionService(fixture.prisma as never);
    await expect(service.rotate('session-1', { mfaSatisfiedAt: NOW, reason: 'MFA_STEP_UP' }))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(fixture.createdSessions).toHaveLength(0);
    expect(fixture.securityEvents).toHaveLength(0);
  });

  it('rejects legacy CSRF migration after a concurrent revocation', async () => {
    const fixture = fakePrisma(activeSession());
    fixture.prisma.session.updateMany.mockResolvedValueOnce({ count: 0 });
    const service = new SessionService(fixture.prisma as never);
    await expect(service.issueCsrf('opaque-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an idle-touch request if concurrent revocation wins', async () => {
    const stale = activeSession({ lastSeenAt: new Date(NOW.getTime() - 40_000) });
    const fixture = fakePrisma(stale);
    fixture.prisma.session.updateMany.mockResolvedValueOnce({ count: 0 });
    fixture.prisma.session.findUnique
      .mockResolvedValueOnce(stale as never)
      .mockResolvedValueOnce({ status: 'REVOKED', expiresAt: stale.expiresAt, lastSeenAt: stale.lastSeenAt } as never);
    process.env['SESSION_TOUCH_INTERVAL_SECONDS'] = '10';
    const service = new SessionService(fixture.prisma as never);
    await expect(service.resolve('opaque-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts a request that lost the touch race to a parallel request of the same live session', async () => {
    const stale = activeSession({ lastSeenAt: new Date(NOW.getTime() - 40_000) });
    const fixture = fakePrisma(stale);
    fixture.prisma.session.updateMany.mockResolvedValueOnce({ count: 0 });
    fixture.prisma.session.findUnique
      .mockResolvedValueOnce(stale as never)
      .mockResolvedValueOnce({ status: 'ACTIVE', expiresAt: stale.expiresAt, lastSeenAt: NOW } as never);
    process.env['SESSION_TOUCH_INTERVAL_SECONDS'] = '10';
    const service = new SessionService(fixture.prisma as never);
    await expect(service.resolve('opaque-token')).resolves.toMatchObject({ id: 'session-1' });
  });

  it('still rejects a touch-race loser whose session went idle in the meantime', async () => {
    const stale = activeSession({ lastSeenAt: new Date(NOW.getTime() - 40_000) });
    const fixture = fakePrisma(stale);
    fixture.prisma.session.updateMany.mockResolvedValueOnce({ count: 0 });
    fixture.prisma.session.findUnique
      .mockResolvedValueOnce(stale as never)
      .mockResolvedValueOnce({ status: 'ACTIVE', expiresAt: stale.expiresAt, lastSeenAt: new Date(NOW.getTime() - 61_000) } as never);
    process.env['SESSION_TOUCH_INTERVAL_SECONDS'] = '10';
    const service = new SessionService(fixture.prisma as never);
    await expect(service.resolve('opaque-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('denies rotation for a deactivated user', async () => {
    const fixture = fakePrisma(activeSession({ user: { id: 'user-1', status: 'SUSPENDED', roleAssignments: [] } }));
    const service = new SessionService(fixture.prisma as never);
    await expect(service.rotate('session-1', { mfaSatisfiedAt: NOW, reason: 'MFA_STEP_UP' }))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(fixture.createdSessions).toHaveLength(0);
  });

});
