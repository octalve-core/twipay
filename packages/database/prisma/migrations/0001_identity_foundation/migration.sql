-- Batch 1 baseline migration. Generated to document the intended identity schema.
-- Before production, `prisma migrate diff`/`prisma migrate dev` must validate this
-- against Prisma 7.10.0 in a network-enabled environment.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "UserStatus" AS ENUM ('PENDING','ACTIVE','SUSPENDED','CLOSED');
CREATE TYPE "IdentityProvider" AS ENUM ('GOOGLE');
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE','REVOKED','EXPIRED');
CREATE TYPE "SecurityEventType" AS ENUM ('REGISTERED','LOGIN_SUCCEEDED','LOGIN_FAILED','LOGOUT','SESSION_REVOKED','PASSWORD_CHANGED','PASSWORD_RESET_REQUESTED','PASSWORD_RESET_COMPLETED','GOOGLE_IDENTITY_LINKED','MFA_ENABLED','MFA_DISABLED','ACCOUNT_SUSPENDED');

CREATE TABLE "users" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" VARCHAR(320) NOT NULL UNIQUE,
  "emailVerifiedAt" TIMESTAMPTZ(6),
  "givenName" VARCHAR(100),
  "familyName" VARCHAR(100),
  "phoneE164" VARCHAR(20) UNIQUE,
  "phoneVerifiedAt" TIMESTAMPTZ(6),
  "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
  "lastLoginAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "users_status_idx" ON "users"("status");

CREATE TABLE "password_credentials" (
  "userId" UUID PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "passwordHash" TEXT NOT NULL,
  "changedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "oauth_identities" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" "IdentityProvider" NOT NULL,
  "providerSubject" VARCHAR(255) NOT NULL,
  "providerEmail" VARCHAR(320),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("provider", "providerSubject")
);
CREATE INDEX "oauth_identities_user_idx" ON "oauth_identities"("userId");

CREATE TABLE "sessions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "tokenHash" CHAR(64) NOT NULL UNIQUE,
  "csrfTokenHash" CHAR(64) NOT NULL,
  "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "userAgent" VARCHAR(512),
  "ipHash" CHAR(64),
  "mfaSatisfiedAt" TIMESTAMPTZ(6),
  "lastSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "revokedAt" TIMESTAMPTZ(6),
  "revokeReason" VARCHAR(120),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "sessions_user_status_idx" ON "sessions"("userId", "status");
CREATE INDEX "sessions_expires_idx" ON "sessions"("expiresAt");

CREATE TABLE "security_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "type" "SecurityEventType" NOT NULL,
  "ipHash" CHAR(64),
  "userAgent" VARCHAR(512),
  "requestId" VARCHAR(64),
  "metadata" JSONB,
  "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "security_events_user_time_idx" ON "security_events"("userId", "occurredAt");
CREATE INDEX "security_events_type_time_idx" ON "security_events"("type", "occurredAt");

CREATE TABLE "roles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(80) NOT NULL UNIQUE,
  "name" VARCHAR(120) NOT NULL,
  "description" VARCHAR(500),
  "system" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "permissions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(120) NOT NULL UNIQUE,
  "description" VARCHAR(500)
);
CREATE TABLE "user_roles" (
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "roleId" UUID NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "assignedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedBy" UUID,
  PRIMARY KEY ("userId","roleId")
);
CREATE TABLE "role_permissions" (
  "roleId" UUID NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
  "permissionId" UUID NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
  PRIMARY KEY ("roleId","permissionId")
);
