-- Phase 3.5: optional customer-supplied location metadata; NOT authoritative KYC or eligibility.
ALTER TABLE "users" ADD COLUMN "countryCode" CHAR(2);
ALTER TABLE "users" ADD COLUMN "stateRegion" VARCHAR(100);
-- Do not modify account verification, financial tables, balances or risk controls.
