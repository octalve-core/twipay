-- Phase 6.3B: independently reviewed limited-role invitation and nonfinancial config changes.
-- No roles, financial permissions, provider activation or customer balances are modified by this migration.
CREATE TABLE "owner_staff_invitations" (
 "id" UUID PRIMARY KEY, "emailCiphertext" TEXT NOT NULL, "emailFingerprint" CHAR(64) NOT NULL,
 "emailMasked" VARCHAR(320) NOT NULL, "roleCode" VARCHAR(80) NOT NULL,
 "status" VARCHAR(20) NOT NULL DEFAULT 'PREPARED',
 "preparedByUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
 "checkedByUserId" UUID REFERENCES "users"("id") ON DELETE RESTRICT,
 "acceptedByUserId" UUID REFERENCES "users"("id") ON DELETE RESTRICT,
 "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "checkedAt" TIMESTAMPTZ(6), "acceptedAt" TIMESTAMPTZ(6), "expiresAt" TIMESTAMPTZ(6) NOT NULL,
 "reason" VARCHAR(500) NOT NULL, "rejectionReason" VARCHAR(500),
 CONSTRAINT "invite_role_allowlist" CHECK ("roleCode" IN ('SUPPORT_AGENT','AUDITOR','COMPLIANCE')),
 CONSTRAINT "invite_status_allowlist" CHECK ("status" IN ('PREPARED','APPROVED','ACCEPTED','REJECTED','REVOKED')),
 CONSTRAINT "invite_independent" CHECK ("checkedByUserId" IS NULL OR "checkedByUserId" <> "preparedByUserId"),
 CONSTRAINT "invite_terminal_evidence" CHECK (
   ("status"='PREPARED' AND "checkedByUserId" IS NULL AND "checkedAt" IS NULL AND "acceptedByUserId" IS NULL AND "acceptedAt" IS NULL AND "rejectionReason" IS NULL) OR
   ("status"='REJECTED' AND "checkedByUserId" IS NOT NULL AND "checkedAt" IS NOT NULL AND "rejectionReason" IS NOT NULL AND "acceptedByUserId" IS NULL AND "acceptedAt" IS NULL) OR
   ("status" IN ('APPROVED','REVOKED') AND "checkedByUserId" IS NOT NULL AND "checkedAt" IS NOT NULL AND "rejectionReason" IS NULL AND "acceptedByUserId" IS NULL AND "acceptedAt" IS NULL) OR
   ("status"='ACCEPTED' AND "checkedByUserId" IS NOT NULL AND "checkedAt" IS NOT NULL AND "acceptedByUserId" IS NOT NULL AND "acceptedAt" IS NOT NULL AND "rejectionReason" IS NULL)),
 CONSTRAINT "invite_accept_evidence" CHECK ("status" <> 'ACCEPTED' OR ("acceptedByUserId" IS NOT NULL AND "acceptedAt" IS NOT NULL))
);
CREATE INDEX "owner_staff_invitations_emailFingerprint_status_idx" ON "owner_staff_invitations"("emailFingerprint","status");
CREATE INDEX "owner_staff_invitations_status_createdAt_idx" ON "owner_staff_invitations"("status","createdAt");
CREATE UNIQUE INDEX "one_live_invite_per_email_role" ON "owner_staff_invitations"("emailFingerprint","roleCode") WHERE "status" IN ('PREPARED','APPROVED');
CREATE OR REPLACE FUNCTION twipay_guard_staff_invitation() RETURNS trigger AS $$
BEGIN
 IF OLD."status" NOT IN ('PREPARED','APPROVED') OR
  NEW."emailCiphertext" IS DISTINCT FROM OLD."emailCiphertext" OR
  NEW."emailFingerprint" IS DISTINCT FROM OLD."emailFingerprint" OR
  NEW."emailMasked" IS DISTINCT FROM OLD."emailMasked" OR
  NEW."roleCode" IS DISTINCT FROM OLD."roleCode" OR
  NEW."preparedByUserId" IS DISTINCT FROM OLD."preparedByUserId" OR
  NEW."reason" IS DISTINCT FROM OLD."reason" OR
  NEW."expiresAt" IS DISTINCT FROM OLD."expiresAt" OR
  (OLD."status"='PREPARED' AND NEW."status" NOT IN ('APPROVED','REJECTED')) OR
  (OLD."status"='APPROVED' AND (NEW."status" NOT IN ('ACCEPTED','REVOKED') OR
    NEW."checkedByUserId" IS DISTINCT FROM OLD."checkedByUserId" OR
    NEW."checkedAt" IS DISTINCT FROM OLD."checkedAt")) THEN
   RAISE EXCEPTION 'owner staff invitation evidence is immutable';
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "owner_staff_invitation_immutable" BEFORE UPDATE ON "owner_staff_invitations"
 FOR EACH ROW EXECUTE FUNCTION twipay_guard_staff_invitation();
CREATE TABLE "owner_config_reviews" (
 "id" UUID PRIMARY KEY, "kind" VARCHAR(30) NOT NULL, "targetKey" VARCHAR(120) NOT NULL,
 "payload" JSONB NOT NULL, "baselineHash" CHAR(64) NOT NULL,
 "status" VARCHAR(20) NOT NULL DEFAULT 'PREPARED',
 "preparedByUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
 "checkedByUserId" UUID REFERENCES "users"("id") ON DELETE RESTRICT,
 "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "checkedAt" TIMESTAMPTZ(6),
 "expiresAt" TIMESTAMPTZ(6) NOT NULL, "reason" VARCHAR(500) NOT NULL,
 "rejectionReason" VARCHAR(500),
 CONSTRAINT "config_kind_allowlist" CHECK ("kind" IN ('BRAND','DEPLOYMENT','FLAG_DISABLE')),
 CONSTRAINT "config_status_allowlist" CHECK ("status" IN ('PREPARED','APPROVED','REJECTED')),
 CONSTRAINT "config_independent" CHECK ("checkedByUserId" IS NULL OR "checkedByUserId"<>"preparedByUserId"),
 CONSTRAINT "config_terminal_evidence" CHECK (
  ("status"='PREPARED' AND "checkedByUserId" IS NULL AND "checkedAt" IS NULL AND "rejectionReason" IS NULL) OR
  ("status"='APPROVED' AND "checkedByUserId" IS NOT NULL AND "checkedAt" IS NOT NULL AND "rejectionReason" IS NULL) OR
  ("status"='REJECTED' AND "checkedByUserId" IS NOT NULL AND "checkedAt" IS NOT NULL AND "rejectionReason" IS NOT NULL))
);
CREATE INDEX "owner_config_reviews_status_createdAt_idx" ON "owner_config_reviews"("status","createdAt");
CREATE UNIQUE INDEX "one_pending_config_change_per_target" ON "owner_config_reviews"("kind","targetKey") WHERE "status"='PREPARED';
CREATE OR REPLACE FUNCTION twipay_guard_owner_config_review() RETURNS trigger AS $$
BEGIN
 IF OLD."status"<>'PREPARED' OR NEW."kind" IS DISTINCT FROM OLD."kind" OR
    NEW."targetKey" IS DISTINCT FROM OLD."targetKey" OR NEW."payload" IS DISTINCT FROM OLD."payload" OR
    NEW."baselineHash" IS DISTINCT FROM OLD."baselineHash" OR NEW."preparedByUserId" IS DISTINCT FROM OLD."preparedByUserId" OR
    NEW."reason" IS DISTINCT FROM OLD."reason" OR NEW."expiresAt" IS DISTINCT FROM OLD."expiresAt" THEN
  RAISE EXCEPTION 'owner configuration review evidence is immutable';
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "owner_config_review_immutable" BEFORE UPDATE ON "owner_config_reviews"
 FOR EACH ROW EXECUTE FUNCTION twipay_guard_owner_config_review();
-- No database default changes to production feature switches.
