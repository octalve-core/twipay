import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

/** Hold a shared session-row lock through a high-risk financial transaction.
 * Concurrent revocation/rotation takes an exclusive row lock and therefore
 * cannot win between this revalidation and the financial commit.
 */
export async function assertTransactionalAuthorization(
  tx: Prisma.TransactionClient,
  input: { userId: string; sessionId: string; permission?: string; recentMfa: boolean },
): Promise<void> {
  const now = new Date();
  const idleSeconds = Number(process.env['SESSION_IDLE_TTL_SECONDS'] ?? 1800);
  const mfaSeconds = Number(process.env['MFA_STEP_UP_MAX_AGE_SECONDS'] ?? 600);
  if (!Number.isInteger(idleSeconds) || idleSeconds < 1 || !Number.isInteger(mfaSeconds) || mfaSeconds < 60 || mfaSeconds > 3600) {
    throw new Error('Invalid session/MFA TTL configuration');
  }
  // Lock before reading session and permissions; revoke/rotate cannot update
  // this session row until our financial transaction completes or rolls back.
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "sessions" WHERE "id"=${input.sessionId}::uuid FOR SHARE
  `;
  if (rows.length !== 1) throw new UnauthorizedException({ code: 'AUTHENTICATION_REQUIRED' });
  const session = await tx.session.findUnique({
    where: { id: input.sessionId },
    include: { user: { include: { roleAssignments: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } } },
  });
  if (!session || session.userId !== input.userId || session.status !== 'ACTIVE' || session.user.status !== 'ACTIVE'
      || session.expiresAt <= now || session.lastSeenAt <= new Date(now.getTime() - idleSeconds * 1000)) {
    throw new UnauthorizedException({ code: 'AUTHENTICATION_REQUIRED' });
  }
  if (input.recentMfa && (!session.mfaSatisfiedAt || session.mfaSatisfiedAt > now
      || session.mfaSatisfiedAt <= new Date(now.getTime() - mfaSeconds * 1000))) {
    throw new ForbiddenException({ code: 'MFA_STEP_UP_REQUIRED' });
  }
  if (input.permission && !session.user.roleAssignments.some(({ role }) => role.code === 'SUPER_ADMIN'
      || role.permissions.some(({ permission }) => permission.code === input.permission))) {
    throw new ForbiddenException({ code: 'PERMISSION_REQUIRED' });
  }
}
