-- Batch 5 production hardening: real TOTP MFA state, recovery-code replay
-- protection, append-only security evidence and session-lifecycle defense.

ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'MFA_ENROLLMENT_STARTED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'MFA_CHALLENGE_SUCCEEDED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'MFA_CHALLENGE_FAILED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'MFA_RECOVERY_USED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'SESSION_ROTATED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'SESSION_EXPIRED';

CREATE TYPE "MfaCredentialStatus" AS ENUM ('PENDING','ACTIVE','DISABLED');

CREATE TABLE "mfa_credentials" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "status" "MfaCredentialStatus" NOT NULL DEFAULT 'PENDING',
  "secretCiphertext" TEXT NOT NULL,
  "lastAcceptedTimeStep" BIGINT,
  "failedAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMPTZ(6),
  "enrollmentStartedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "enabledAt" TIMESTAMPTZ(6),
  "disabledAt" TIMESTAMPTZ(6),
  "disabledReason" VARCHAR(160),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mfa_credentials_failed_attempts_nonnegative" CHECK ("failedAttempts" >= 0)
);
CREATE INDEX "mfa_credentials_user_status_idx" ON "mfa_credentials"("userId","status");
CREATE INDEX "mfa_credentials_locked_until_idx" ON "mfa_credentials"("lockedUntil");
-- A disabled credential remains as audit history. A user can have only one
-- pending/active credential at a time, so re-enrollment is explicit rather
-- than an in-place secret rewrite.
CREATE UNIQUE INDEX "mfa_credentials_one_current_per_user"
  ON "mfa_credentials"("userId") WHERE "status" IN ('PENDING','ACTIVE');

CREATE TABLE "mfa_recovery_codes" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "credentialId" UUID NOT NULL REFERENCES "mfa_credentials"("id") ON DELETE RESTRICT,
  "codeHash" CHAR(64) NOT NULL UNIQUE,
  "usedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "mfa_recovery_codes_credential_used_idx" ON "mfa_recovery_codes"("credentialId","usedAt");

CREATE INDEX "sessions_status_last_seen_idx" ON "sessions"("status","lastSeenAt");

CREATE OR REPLACE FUNCTION twipay_guard_session_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'TwiPay sessions cannot be deleted';
  END IF;

  IF NEW."userId" <> OLD."userId"
     OR NEW."tokenHash" <> OLD."tokenHash"
     OR NEW."userAgent" IS DISTINCT FROM OLD."userAgent"
     OR NEW."ipHash" IS DISTINCT FROM OLD."ipHash"
     OR NEW."expiresAt" <> OLD."expiresAt"
     OR NEW."createdAt" <> OLD."createdAt"
     OR NEW."mfaSatisfiedAt" IS DISTINCT FROM OLD."mfaSatisfiedAt"
  THEN
    RAISE EXCEPTION 'TwiPay session identity/assurance fields are immutable; rotate the session instead';
  END IF;

  IF NEW."lastSeenAt" < OLD."lastSeenAt" THEN
    RAISE EXCEPTION 'TwiPay session lastSeenAt cannot move backwards';
  END IF;

  IF NEW."status" = OLD."status" THEN
    IF NEW."revokedAt" IS DISTINCT FROM OLD."revokedAt" OR NEW."revokeReason" IS DISTINCT FROM OLD."revokeReason" THEN
      RAISE EXCEPTION 'TwiPay session revocation metadata requires a lifecycle transition';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."status" <> 'ACTIVE' OR NEW."status" NOT IN ('REVOKED','EXPIRED') THEN
    RAISE EXCEPTION 'Invalid TwiPay session transition % -> %', OLD."status", NEW."status";
  END IF;
  IF NEW."revokedAt" IS NULL OR NEW."revokeReason" IS NULL OR length(trim(NEW."revokeReason")) = 0 THEN
    RAISE EXCEPTION 'TwiPay ended sessions require timestamp and reason';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "sessions_mutation_guard"
  BEFORE UPDATE OR DELETE ON "sessions"
  FOR EACH ROW EXECUTE FUNCTION twipay_guard_session_mutation();

CREATE OR REPLACE FUNCTION twipay_guard_mfa_credential_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'TwiPay MFA credentials are auditable and cannot be deleted';
  END IF;

  IF NEW."userId" <> OLD."userId"
     OR NEW."secretCiphertext" <> OLD."secretCiphertext"
     OR NEW."enrollmentStartedAt" <> OLD."enrollmentStartedAt"
     OR NEW."createdAt" <> OLD."createdAt"
  THEN
    RAISE EXCEPTION 'TwiPay MFA credential identity/secret is immutable; re-enroll instead';
  END IF;

  IF OLD."lastAcceptedTimeStep" IS NOT NULL
     AND (NEW."lastAcceptedTimeStep" IS NULL
          OR NEW."lastAcceptedTimeStep" <= OLD."lastAcceptedTimeStep")
  THEN
    RAISE EXCEPTION 'TwiPay TOTP timestep must advance to prevent replay';
  END IF;

  IF NEW."failedAttempts" < 0 THEN
    RAISE EXCEPTION 'TwiPay MFA failed-attempt counter cannot be negative';
  END IF;

  IF NEW."status" <> OLD."status" THEN
    IF OLD."status" = 'PENDING' AND NEW."status" IN ('ACTIVE','DISABLED') THEN
      NULL;
    ELSIF OLD."status" = 'ACTIVE' AND NEW."status" = 'DISABLED' THEN
      NULL;
    ELSE
      RAISE EXCEPTION 'Invalid TwiPay MFA credential transition % -> %', OLD."status", NEW."status";
    END IF;
  END IF;

  IF OLD."enabledAt" IS NOT NULL AND NEW."enabledAt" IS DISTINCT FROM OLD."enabledAt" THEN
    RAISE EXCEPTION 'TwiPay MFA enabled timestamp is immutable';
  END IF;
  IF OLD."disabledAt" IS NOT NULL AND NEW."disabledAt" IS DISTINCT FROM OLD."disabledAt" THEN
    RAISE EXCEPTION 'TwiPay MFA disabled timestamp is immutable';
  END IF;

  IF NEW."status" = 'PENDING' AND (NEW."enabledAt" IS NOT NULL OR NEW."disabledAt" IS NOT NULL) THEN
    RAISE EXCEPTION 'Pending TwiPay MFA credential cannot have lifecycle completion timestamps';
  END IF;
  IF NEW."status" = 'ACTIVE' AND (NEW."enabledAt" IS NULL OR NEW."disabledAt" IS NOT NULL) THEN
    RAISE EXCEPTION 'Active TwiPay MFA credential requires enabledAt and no disabledAt';
  END IF;
  IF NEW."status" = 'DISABLED' AND (NEW."disabledAt" IS NULL OR NEW."disabledReason" IS NULL) THEN
    RAISE EXCEPTION 'Disabled TwiPay MFA credential requires timestamp and reason';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "mfa_credentials_mutation_guard"
  BEFORE UPDATE OR DELETE ON "mfa_credentials"
  FOR EACH ROW EXECUTE FUNCTION twipay_guard_mfa_credential_mutation();

CREATE OR REPLACE FUNCTION twipay_guard_mfa_recovery_code_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'TwiPay MFA recovery codes cannot be deleted';
  END IF;
  IF NEW."credentialId" <> OLD."credentialId"
     OR NEW."codeHash" <> OLD."codeHash"
     OR NEW."createdAt" <> OLD."createdAt"
  THEN
    RAISE EXCEPTION 'TwiPay MFA recovery-code identity is immutable';
  END IF;
  IF OLD."usedAt" IS NOT NULL AND NEW."usedAt" IS DISTINCT FROM OLD."usedAt" THEN
    RAISE EXCEPTION 'Used TwiPay MFA recovery code cannot be replayed or reset';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "mfa_recovery_codes_mutation_guard"
  BEFORE UPDATE OR DELETE ON "mfa_recovery_codes"
  FOR EACH ROW EXECUTE FUNCTION twipay_guard_mfa_recovery_code_mutation();

CREATE OR REPLACE FUNCTION twipay_security_event_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'TwiPay security events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "security_events_immutable"
  BEFORE UPDATE OR DELETE ON "security_events"
  FOR EACH ROW EXECUTE FUNCTION twipay_security_event_append_only();
