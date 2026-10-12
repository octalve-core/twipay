import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ConflictException, ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import * as oidc from 'openid-client';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import { SESSION_IDLE_TTL_SECONDS, isRecentMfaAssurance } from '@twipay/security';
import { SessionService, type SessionMaterial } from '../application/session.service.js';
import { PasswordHasher } from './password-hasher.js';
import { contactVerified } from '../application/contact-permissions.js';

const GOOGLE_ISSUER = 'https://accounts.google.com';
const FLOW_TTL_MS = 5 * 60_000;
const BINDING_COOKIE = 'twipay_google_binding';
const LOGIN_DENIED = { code: 'GOOGLE_SIGN_IN_UNAVAILABLE' };

type Purpose = 'SIGN_IN' | 'LINK';
type GoogleIdentity = { sub: string; email: string; email_verified: true; given_name?: string; family_name?: string };

function requiredEnvironment(): { clientId: string; secret: string; redirect: string; appUrl: string; key: Buffer; pepper: string } {
  const clientId = process.env['GOOGLE_CLIENT_ID'] ?? '';
  const secret = process.env['GOOGLE_CLIENT_SECRET'] ?? '';
  const redirect = process.env['GOOGLE_REDIRECT_URI'] ?? '';
  const appUrl = process.env['APP_URL'] ?? '';
  const pepper = process.env['SESSION_HASH_PEPPER'] ?? '';
  const rawKey = process.env['GOOGLE_OIDC_TRANSACTION_KEY'] ?? '';
  const key = Buffer.from(rawKey, 'base64');
  if (process.env['GOOGLE_OIDC_ENABLED'] !== 'true' || !clientId || !secret || pepper.length < 32 || key.length !== 32) throw new Error('GOOGLE_OIDC_NOT_CONFIGURED');
  const callback = new URL(redirect);
  const customer = new URL(appUrl);
  // Callback redirects must be explicitly registered: never accept URL parameters from the browser.
  if (callback.pathname !== '/v1/auth/google/callback' || callback.search || callback.hash ||
      (callback.protocol !== 'https:' && !(callback.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(callback.hostname))) ||
      (customer.protocol !== 'https:' && !(customer.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(customer.hostname)))) throw new Error('GOOGLE_OIDC_INVALID_REDIRECT');
  return { clientId, secret, redirect: callback.href, appUrl: customer.origin, key, pepper };
}
function digest(secret: string, namespace: string, value: string): string {
  return createHmac('sha256', secret).update(namespace).update('\0').update(value).digest('hex');
}
function equalHex(left: string, right: string): boolean {
  if (!/^[a-f\d]{64}$/.test(left) || !/^[a-f\d]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}
function encrypt(value: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `g1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${encrypted.toString('base64url')}`;
}
function decrypt(encoded: string, key: Buffer): string {
  const [version, iv, tag, content] = encoded.split(':');
  if (version !== 'g1' || !iv || !tag || !content) throw new Error('GOOGLE_OIDC_INVALID_TRANSACTION');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(content, 'base64url')), decipher.final()]).toString('utf8');
}

@Injectable()
export class GoogleOidcService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly passwords: PasswordHasher,
  ) {}

  async isLinked(userId: string): Promise<boolean> {
    return (await this.prisma.oAuthIdentity.count({ where: { userId, provider: 'GOOGLE' } })) > 0;
  }

  enabled(): boolean {
    try { requiredEnvironment(); return true; } catch { return false; }
  }

  private async provider() {
    const env = requiredEnvironment();
    const configuration = await oidc.discovery(new URL(GOOGLE_ISSUER), env.clientId, env.secret);
    return { env, configuration };
  }

  async start(input: { purpose: Purpose; sessionId?: string; userId?: string; currentPassword?: string }) {
    if (!this.enabled()) throw new ServiceUnavailableException({ code: 'GOOGLE_SIGN_IN_UNAVAILABLE' });
    if (input.purpose === 'LINK') {
      if (!input.userId || !input.sessionId || !input.currentPassword) throw new ForbiddenException({ code: 'REAUTHENTICATION_REQUIRED' });
      const user = await this.prisma.user.findUnique({ where: { id: input.userId }, include: { passwordCredential: true } });
      if (!user || user.status !== 'ACTIVE' || !contactVerified(user) || !user.passwordCredential ||
          !(await this.passwords.verify(user.passwordCredential.passwordHash, input.currentPassword))) {
        throw new ForbiddenException({ code: 'REAUTHENTICATION_REQUIRED' });
      }
    }
    const { env, configuration } = await this.provider();
    const state = oidc.randomState();
    const nonce = oidc.randomNonce();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const cookie = randomBytes(32).toString('base64url');
    const challenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
    const url = oidc.buildAuthorizationUrl(configuration, {
      redirect_uri: env.redirect,
      scope: 'openid email profile',
      response_type: 'code',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
      nonce,
    });
    await this.prisma.googleOidcTransaction.create({
      data: {
        stateHash: digest(env.pepper, 'google-state', state),
        bindingHash: digest(env.pepper, 'google-browser-binding', cookie),
        nonce,
        verifierCiphertext: encrypt(codeVerifier, env.key),
        purpose: input.purpose,
        userId: input.userId ?? null,
        sessionId: input.sessionId ?? null,
        expiresAt: new Date(Date.now() + FLOW_TTL_MS),
      },
    });
    return { authorizationUrl: url.href, browserBinding: cookie };
  }

  /** The callback is GET from Google, authenticated by browser binding + state, not a CSRF-less POST. */
  async complete(input: { state?: string; code?: string; binding?: string; userAgent?: string; ip?: string }): Promise<{ purpose: Purpose; session?: SessionMaterial }> {
    if (!input.state || !input.code || !input.binding || input.state.length > 256 || input.code.length > 4096 || input.binding.length > 256) {
      throw new UnauthorizedException(LOGIN_DENIED);
    }
    const { env, configuration } = await this.provider();
    const stateHash = digest(env.pepper, 'google-state', input.state);
    const pending = await this.prisma.googleOidcTransaction.findUnique({ where: { stateHash } });
    if (!pending || !equalHex(pending.bindingHash, digest(env.pepper, 'google-browser-binding', input.binding))) {
      throw new UnauthorizedException(LOGIN_DENIED);
    }
    // Atomic consumption BEFORE contacting Google. A duplicate/replayed callback cannot race another token exchange.
    const consumed = await this.prisma.googleOidcTransaction.updateMany({
      where: { id: pending.id, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });
    if (consumed.count !== 1) throw new UnauthorizedException(LOGIN_DENIED);

    const callbackUrl = new URL(env.redirect);
    callbackUrl.searchParams.set('code', input.code);
    callbackUrl.searchParams.set('state', input.state);
    let identity: GoogleIdentity;
    try {
      const tokens = await oidc.authorizationCodeGrant(configuration, callbackUrl, {
        pkceCodeVerifier: decrypt(pending.verifierCiphertext, env.key),
        expectedState: input.state,
        expectedNonce: pending.nonce,
        idTokenExpected: true,
      });
      const claims = tokens.claims();
      if (!claims || (claims.iss !== GOOGLE_ISSUER && claims.iss !== 'accounts.google.com') ||
          !claims.sub || claims.sub.length > 255 || typeof claims['email'] !== 'string' ||
          claims['email_verified'] !== true || !/^\S+@\S+\.\S+$/.test(claims['email'])) throw new Error('GOOGLE_IDENTITY_INVALID');
      identity = { sub: claims.sub, email: claims['email'].toLowerCase(), email_verified: true,
        ...(typeof claims['given_name'] === 'string' ? { given_name: claims['given_name'] } : {}),
        ...(typeof claims['family_name'] === 'string' ? { family_name: claims['family_name'] } : {}) };
    } catch {
      throw new UnauthorizedException(LOGIN_DENIED);
    }
    if (pending.purpose === 'LINK') {
      if (!pending.userId || !pending.sessionId) throw new UnauthorizedException(LOGIN_DENIED);
      await this.prisma.$transaction(async (tx) => {
        // Serialize linking with password changes (which lock the user row), and
        // session revocation. No revoked session may authorize a new provider link.
        await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${pending.userId}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "sessions" WHERE "id" = ${pending.sessionId}::uuid FOR UPDATE`;
        const active = await tx.session.findFirst({ where: {
          id: pending.sessionId!, userId: pending.userId!, status: 'ACTIVE',
          expiresAt: { gt: new Date() },
          lastSeenAt: { gt: new Date(Date.now() - Number(process.env['SESSION_IDLE_TTL_SECONDS'] ?? SESSION_IDLE_TTL_SECONDS) * 1000) },
        }, include: { user: { select: { status: true, emailVerifiedAt: true, phoneE164: true, phoneVerifiedAt: true, mfaCredentials: { where: { status: 'ACTIVE' }, select: { id: true } } } } } });
        if (!active || active.user.status !== 'ACTIVE' || !contactVerified(active.user) ||
            (active.user.mfaCredentials.length > 0 && !isRecentMfaAssurance(active.mfaSatisfiedAt, Number(process.env['MFA_STEP_UP_MAX_AGE_SECONDS'] ?? 600)))) {
          throw new ForbiddenException({ code: 'ACCOUNT_LINK_NOT_ALLOWED' });
        }
        const linked = await tx.oAuthIdentity.findUnique({ where: { provider_providerSubject: { provider: 'GOOGLE', providerSubject: identity.sub } } });
        if (linked && linked.userId !== pending.userId) throw new ConflictException({ code: 'GOOGLE_ACCOUNT_ALREADY_LINKED' });
        if (!linked) {
          await tx.oAuthIdentity.create({ data: { userId: pending.userId!, provider: 'GOOGLE', providerSubject: identity.sub, providerEmail: identity.email } });
          await tx.securityEvent.create({ data: { userId: pending.userId!, type: 'GOOGLE_IDENTITY_LINKED' } });
        }
      });
      return { purpose: 'LINK' };
    }

    let userId: string;
    try {
      userId = await this.prisma.$transaction(async (tx) => {
        const linked = await tx.oAuthIdentity.findUnique({ where: { provider_providerSubject: { provider: 'GOOGLE', providerSubject: identity.sub } } });
        if (linked) {
          const user = await tx.user.findUnique({ where: { id: linked.userId }, select: { id: true, status: true } });
          if (user?.status !== 'ACTIVE') throw new UnauthorizedException(LOGIN_DENIED);
          return user.id;
        }
        // Email equality is NEVER account ownership proof. Existing accounts must link via reauthenticated settings.
        const collision = await tx.user.findUnique({ where: { email: identity.email }, select: { id: true } });
        if (collision) throw new ConflictException({ code: 'GOOGLE_ACCOUNT_LINK_REQUIRED' });
        const user = await tx.user.create({ data: {
          email: identity.email,
          emailVerifiedAt: new Date(),
          status: 'ACTIVE',
          ...(identity.given_name ? { givenName: identity.given_name.slice(0, 100) } : {}),
          ...(identity.family_name ? { familyName: identity.family_name.slice(0, 100) } : {}),
          oauthIdentities: { create: { provider: 'GOOGLE', providerSubject: identity.sub, providerEmail: identity.email } },
        }, select: { id: true } });
        await tx.securityEvent.create({ data: { userId: user.id, type: 'REGISTERED' } });
        await tx.securityEvent.create({ data: { userId: user.id, type: 'GOOGLE_IDENTITY_LINKED' } });
        return user.id;
      });
    } catch (error) {
      if (error instanceof ConflictException || error instanceof UnauthorizedException) throw error;
      // Unique-constraint races must NEVER select the competing email account as an implicit link.
      throw new UnauthorizedException(LOGIN_DENIED);
    }
    await this.prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
    await this.prisma.securityEvent.create({ data: { userId, type: 'LOGIN_SUCCEEDED', metadata: { method: 'GOOGLE_OIDC' } } });
    const session = await this.sessions.create(userId, input.userAgent, input.ip);
    return { purpose: 'SIGN_IN', session };
  }
}

export const GOOGLE_OIDC_COOKIE = BINDING_COOKIE;
export const GOOGLE_OIDC_FLOW_TTL_SECONDS = FLOW_TTL_MS / 1000;
