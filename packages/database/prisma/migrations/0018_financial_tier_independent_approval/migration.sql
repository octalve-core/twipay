-- Independent, evidence-backed tier approvals. NO financial product activation.
CREATE TYPE "FinancialTierReviewStatus" AS ENUM ('PREPARED', 'APPROVED', 'REJECTED');
CREATE TABLE "financial_tier_reviews" (
  "id" UUID NOT NULL PRIMARY KEY,
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "status" "FinancialTierReviewStatus" NOT NULL DEFAULT 'PREPARED',
  "proposedTier" INTEGER NOT NULL,
  "maxPerIntentMinor" BIGINT NOT NULL,
  "maxDailyDebitMinor" BIGINT NOT NULL,
  "evidenceReference" VARCHAR(150) NOT NULL,
  "note" VARCHAR(1000) NOT NULL,
  "preparedByUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "checkedByUserId" UUID REFERENCES "users"("id") ON DELETE RESTRICT,
  "checkedAt" TIMESTAMPTZ(6),
  "rejectionReason" VARCHAR(500),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tier_review_limits" CHECK ("proposedTier" BETWEEN 1 AND 3 AND "maxPerIntentMinor">0 AND "maxDailyDebitMinor">0 AND "maxPerIntentMinor"<="maxDailyDebitMinor"),
  CONSTRAINT "tier_review_maker_not_customer" CHECK ("preparedByUserId"<>"userId"),
  CONSTRAINT "tier_review_checker_separation" CHECK ("checkedByUserId" IS NULL OR ("checkedByUserId"<>"userId" AND "checkedByUserId"<>"preparedByUserId")),
  CONSTRAINT "tier_review_terminal_evidence" CHECK (
    ("status"='PREPARED' AND "checkedByUserId" IS NULL AND "checkedAt" IS NULL AND "rejectionReason" IS NULL) OR
    ("status"='APPROVED' AND "checkedByUserId" IS NOT NULL AND "checkedAt" IS NOT NULL AND "rejectionReason" IS NULL) OR
    ("status"='REJECTED' AND "checkedByUserId" IS NOT NULL AND "checkedAt" IS NOT NULL AND "rejectionReason" IS NOT NULL)
  )
);
CREATE INDEX "financial_tier_reviews_status_createdAt_idx" ON "financial_tier_reviews" ("status","createdAt");
CREATE INDEX "financial_tier_reviews_userId_createdAt_idx" ON "financial_tier_reviews" ("userId","createdAt");
CREATE UNIQUE INDEX "only_one_prepared_tier_review_per_user" ON "financial_tier_reviews"("userId") WHERE "status"='PREPARED';
-- Do not permit editing a prepared proposal (reviewer must reject and submit a new one).
CREATE OR REPLACE FUNCTION twipay_guard_financial_tier_reviews() RETURNS trigger AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF OLD."status"<>'PREPARED' THEN RAISE EXCEPTION 'terminal tier review is immutable'; END IF;
    IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW."userId" IS DISTINCT FROM OLD."userId" OR
       NEW."preparedByUserId" IS DISTINCT FROM OLD."preparedByUserId" OR
       NEW."proposedTier" IS DISTINCT FROM OLD."proposedTier" OR
       NEW."maxPerIntentMinor" IS DISTINCT FROM OLD."maxPerIntentMinor" OR
       NEW."maxDailyDebitMinor" IS DISTINCT FROM OLD."maxDailyDebitMinor" OR
       NEW."evidenceReference" IS DISTINCT FROM OLD."evidenceReference" OR
       NEW."note" IS DISTINCT FROM OLD."note" THEN
      RAISE EXCEPTION 'prepared financial tier evidence cannot be altered';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "financial_tier_reviews_immutable"
  BEFORE UPDATE ON "financial_tier_reviews" FOR EACH ROW EXECUTE FUNCTION twipay_guard_financial_tier_reviews();
INSERT INTO "permissions"("id","code","description") VALUES
  (gen_random_uuid(),'ops.tiers.read','View restricted financial tier review queue'),
  (gen_random_uuid(),'ops.tiers.prepare','Prepare evidence-backed customer financial tier proposal'),
  (gen_random_uuid(),'ops.tiers.approve','Independently approve/reject customer financial tier proposal')
ON CONFLICT ("code") DO NOTHING;
INSERT INTO "role_permissions"("roleId","permissionId")
SELECT r."id",p."id" FROM "roles" r JOIN "permissions" p ON
 (r."code"='SUPER_ADMIN' AND p."code" LIKE 'ops.tiers.%') OR
 (r."code" IN ('OPERATIONS','FINANCE_OPERATOR','FINANCE_APPROVER','COMPLIANCE','AUDITOR') AND p."code"='ops.tiers.read') OR
 (r."code" IN ('FINANCE_OPERATOR','COMPLIANCE') AND p."code"='ops.tiers.prepare') OR
 (r."code"='FINANCE_APPROVER' AND p."code"='ops.tiers.approve')
ON CONFLICT DO NOTHING;
-- Guard accidental direct policy activation without an independently approved review.
-- Does not grant any operational permission or enable providers.
CREATE OR REPLACE FUNCTION twipay_guard_policy_needs_review() RETURNS trigger AS $$
DECLARE must_check BOOLEAN := FALSE;
BEGIN
  IF NEW."status"='APPROVED' THEN
    IF TG_OP='INSERT' THEN
      must_check := TRUE;
    ELSE
      must_check := OLD."status" IS DISTINCT FROM NEW."status" OR
        OLD."approvedKycTier" IS DISTINCT FROM NEW."approvedKycTier" OR
        OLD."maxPerIntentMinor" IS DISTINCT FROM NEW."maxPerIntentMinor" OR
        OLD."maxDailyDebitMinor" IS DISTINCT FROM NEW."maxDailyDebitMinor" OR
        OLD."approvedAt" IS DISTINCT FROM NEW."approvedAt";
    END IF;
  END IF;
  IF must_check THEN
    IF NOT EXISTS (SELECT 1 FROM "financial_tier_reviews" r WHERE r."userId"=NEW."userId"
      AND r."status"='APPROVED' AND r."checkedByUserId" IS NOT NULL
      AND r."checkedByUserId"<>r."preparedByUserId"
      AND r."proposedTier"=NEW."approvedKycTier"
      AND r."maxPerIntentMinor"=NEW."maxPerIntentMinor"
      AND r."maxDailyDebitMinor"=NEW."maxDailyDebitMinor"
      AND r."checkedAt"=NEW."approvedAt") THEN
      RAISE EXCEPTION 'approved financial policy requires matching independent reviewed evidence';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "financial_policy_requires_independent_review"
  BEFORE INSERT OR UPDATE ON "financial_eligibility_policies" FOR EACH ROW EXECUTE FUNCTION twipay_guard_policy_needs_review();

-- No existing account is auto-approved or assigned any financial limits.
