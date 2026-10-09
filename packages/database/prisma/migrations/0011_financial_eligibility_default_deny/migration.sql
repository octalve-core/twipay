-- Phase 4.1: no automatic approvals, no monetary feature enablement.
CREATE TYPE "FinancialEligibilityStatus" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED');
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'FINANCIAL_PIN_AUTHORIZED';
CREATE TABLE "financial_eligibility_policies" (
  "userId" UUID NOT NULL PRIMARY KEY,
  "status" "FinancialEligibilityStatus" NOT NULL DEFAULT 'PENDING',
  "approvedKycTier" INTEGER NOT NULL DEFAULT 0,
  "maxPerIntentMinor" BIGINT NOT NULL DEFAULT 0,
  "maxDailyDebitMinor" BIGINT NOT NULL DEFAULT 0,
  "approvedAt" TIMESTAMPTZ(6),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_eligibility_policies_user_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "financial_eligibility_tier_bounds" CHECK ("approvedKycTier" BETWEEN 0 AND 3),
  CONSTRAINT "financial_eligibility_nonnegative_limits" CHECK ("maxPerIntentMinor" >= 0 AND "maxDailyDebitMinor" >= 0),
  CONSTRAINT "financial_eligibility_approved_requires_evidence" CHECK (
    "status" <> 'APPROVED' OR
    ("approvedKycTier" >= 1 AND "maxPerIntentMinor" > 0 AND "maxDailyDebitMinor" > 0 AND "approvedAt" IS NOT NULL)
  )
);
-- No backfill: accounts without an independently approved, risk-reviewed policy remain ineligible.
