import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { normalizeEmail, validatePasswordPolicy } from '@twipay/security';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { PasswordHasher } from '../infrastructure/password-hasher.js';
import { SessionService } from './session.service.js';
import { ContactVerificationService } from './contact-verification.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordHasher,
    private readonly sessions: SessionService,
    private readonly contacts: ContactVerificationService,
  ) {}

  async register(input: { email: string; password: string; givenName?: string; familyName?: string }, context: { userAgent?: string; ip?: string }) {
    const email = normalizeEmail(input.email);
    const failures = validatePasswordPolicy(input.password);
    if (failures.length) throw new ConflictException({ code: failures[0] });
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw new ConflictException({ code: 'ACCOUNT_ALREADY_EXISTS' });
    const passwordHash = await this.passwords.hash(input.password);
    const createdAccount = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          ...(input.givenName ? { givenName: input.givenName } : {}),
          ...(input.familyName ? { familyName: input.familyName } : {}),
          status: 'ACTIVE',
          passwordCredential: { create: { passwordHash } },
        },
        select: { id: true, email: true, givenName: true, familyName: true, status: true },
      });
      await tx.securityEvent.create({ data: { userId: created.id, type: 'REGISTERED' } });
      const notificationId = await this.contacts.issueInitialWithTx(tx, created.id, created.email);
      return { user: created, notificationId };
    });
    const session = await this.sessions.create(createdAccount.user.id, context.userAgent, context.ip);
    const deliveryStatus = await this.contacts.dispatch(createdAccount.notificationId);
    return { user: createdAccount.user, session, deliveryStatus };
  }


  async identityVerificationSummary(userId: string): Promise<'NOT_STARTED' | 'IN_PROGRESS' | 'VERIFIED'> {
    const verified = await this.prisma.identityVerification.findFirst({
      where: { userId, type: 'BVN', status: 'VERIFIED' }, select: { id: true },
    });
    if (verified) return 'VERIFIED';
    const any = await this.prisma.identityVerification.findFirst({
      where: { userId, OR: [
        { status: { in: ['CREATED', 'PENDING'] } },
        { status: 'AWAITING_CONSENT', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      ] }, select: { id: true },
    });
    return any ? 'IN_PROGRESS' : 'NOT_STARTED';
  }

  async updateProfile(userId: string, input: { givenName?: string | null; familyName?: string | null; countryCode?: string | null; stateRegion?: string | null }) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.givenName !== undefined ? { givenName: input.givenName || null } : {}),
        ...(input.familyName !== undefined ? { familyName: input.familyName || null } : {}),
        ...(input.countryCode !== undefined ? { countryCode: input.countryCode } : {}),
        ...(input.stateRegion !== undefined ? { stateRegion: input.stateRegion } : {}),
      },
      select: { id: true, email: true, givenName: true, familyName: true, countryCode: true, stateRegion: true, status: true },
    });
  }

  async login(input: { email: string; password: string }, context: { userAgent?: string; ip?: string }) {
    const email = normalizeEmail(input.email);
    const user = await this.prisma.user.findUnique({ where: { email }, include: { passwordCredential: true } });
    if (!user?.passwordCredential || user.status !== 'ACTIVE') throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
    if (!(await this.passwords.verify(user.passwordCredential.passwordHash, input.password))) {
      await this.prisma.securityEvent.create({ data: { userId: user.id, type: 'LOGIN_FAILED' } });
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS' });
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.prisma.securityEvent.create({ data: { userId: user.id, type: 'LOGIN_SUCCEEDED' } });
    const session = await this.sessions.create(user.id, context.userAgent, context.ip);
    return { user: { id: user.id, email: user.email, givenName: user.givenName, familyName: user.familyName, status: user.status }, session };
  }
}
