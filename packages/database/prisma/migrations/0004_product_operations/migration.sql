-- Batch 4 product experience + operations.
-- High-risk administrative actions are audited and money movement preserves
-- immutable ledger/accounting boundaries established in Batch 2/3.

ALTER TYPE "FinancialTransactionType" ADD VALUE IF NOT EXISTS 'ORGANIZER_PAYOUT';
ALTER TYPE "ReconciliationCaseType" ADD VALUE IF NOT EXISTS 'REFUND_MISMATCH';
ALTER TYPE "ReconciliationCaseType" ADD VALUE IF NOT EXISTS 'ORGANIZER_PAYOUT_MISMATCH';

CREATE TYPE "DisputeStatus" AS ENUM ('OPEN','UNDER_REVIEW','APPROVED','REJECTED','RESOLVED','CANCELLED');
CREATE TYPE "RefundStatus" AS ENUM ('REQUESTED','UNDER_REVIEW','APPROVED','PROCESSING','SUCCEEDED','FAILED','UNKNOWN','REJECTED');
CREATE TYPE "OrganizerPayoutStatus" AS ENUM ('REQUESTED','PENDING_APPROVAL','APPROVED','PROVIDER_SUBMITTED','PROCESSING','UNKNOWN','SUCCEEDED','FAILED','REJECTED','REVERSED');

CREATE TABLE "disputes" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "reference" VARCHAR(100) NOT NULL UNIQUE,
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "financialTransactionId" UUID NOT NULL REFERENCES "financial_transactions"("id") ON DELETE RESTRICT,
  "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
  "category" VARCHAR(80) NOT NULL,
  "reasonCode" VARCHAR(80) NOT NULL,
  "detailsCiphertext" TEXT NOT NULL,
  "resolutionCiphertext" TEXT,
  "assignedToUserId" UUID,
  "openedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMPTZ(6),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "disputes_user_time_idx" ON "disputes"("userId","openedAt");
CREATE INDEX "disputes_status_time_idx" ON "disputes"("status","openedAt");
CREATE INDEX "disputes_financial_status_idx" ON "disputes"("financialTransactionId","status");

CREATE TABLE "refund_requests" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "reference" VARCHAR(100) NOT NULL UNIQUE,
  "disputeId" UUID UNIQUE REFERENCES "disputes"("id") ON DELETE RESTRICT,
  "originalFinancialTransactionId" UUID NOT NULL UNIQUE REFERENCES "financial_transactions"("id") ON DELETE RESTRICT,
  "refundFinancialTransactionId" UUID UNIQUE REFERENCES "financial_transactions"("id") ON DELETE RESTRICT,
  "requestedByUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "reviewedByUserId" UUID REFERENCES "users"("id") ON DELETE RESTRICT,
  "approvedByUserId" UUID REFERENCES "users"("id") ON DELETE RESTRICT,
  "status" "RefundStatus" NOT NULL DEFAULT 'REQUESTED',
  "amountMinor" BIGINT NOT NULL CHECK ("amountMinor" > 0),
  "currency" CHAR(3) NOT NULL CHECK ("currency" ~ '^[A-Z]{3}$'),
  "reasonCode" VARCHAR(80) NOT NULL,
  "reviewNoteCiphertext" TEXT,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMPTZ(6)
);
CREATE INDEX "refund_requests_status_time_idx" ON "refund_requests"("status","createdAt");

CREATE TABLE "organizer_payouts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "reference" VARCHAR(100) NOT NULL UNIQUE,
  "organizerId" UUID NOT NULL REFERENCES "event_organizers"("id") ON DELETE RESTRICT,
  "beneficiaryId" UUID NOT NULL REFERENCES "beneficiaries"("id") ON DELETE RESTRICT,
  "financialTransactionId" UUID UNIQUE REFERENCES "financial_transactions"("id") ON DELETE RESTRICT,
  "providerOperationId" UUID UNIQUE REFERENCES "provider_operations"("id") ON DELETE RESTRICT,
  "status" "OrganizerPayoutStatus" NOT NULL DEFAULT 'REQUESTED',
  "amountMinor" BIGINT NOT NULL CHECK ("amountMinor" > 0),
  "currency" CHAR(3) NOT NULL CHECK ("currency" ~ '^[A-Z]{3}$'),
  "providerCode" VARCHAR(40) NOT NULL,
  "narration" VARCHAR(160) NOT NULL,
  "requestedByUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "preparedByUserId" UUID REFERENCES "users"("id") ON DELETE RESTRICT,
  "approvedByUserId" UUID REFERENCES "users"("id") ON DELETE RESTRICT,
  "rejectionReason" VARCHAR(255),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMPTZ(6)
);
CREATE INDEX "organizer_payouts_org_status_idx" ON "organizer_payouts"("organizerId","status","createdAt");
CREATE INDEX "organizer_payouts_status_time_idx" ON "organizer_payouts"("status","createdAt");

CREATE TABLE "operational_audit_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "actorUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "action" VARCHAR(120) NOT NULL,
  "targetType" VARCHAR(80) NOT NULL,
  "targetId" VARCHAR(120) NOT NULL,
  "reason" VARCHAR(500),
  "requestId" VARCHAR(64),
  "beforeState" JSONB,
  "afterState" JSONB,
  "occurredAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "operational_audit_actor_time_idx" ON "operational_audit_events"("actorUserId","occurredAt");
CREATE INDEX "operational_audit_target_time_idx" ON "operational_audit_events"("targetType","targetId","occurredAt");
CREATE INDEX "operational_audit_action_time_idx" ON "operational_audit_events"("action","occurredAt");

CREATE TABLE "bill_offer_equivalence_verifications" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "providerOfferId" UUID NOT NULL REFERENCES "bill_provider_offers"("id") ON DELETE RESTRICT,
  "previousProductId" UUID NOT NULL REFERENCES "bill_products"("id") ON DELETE RESTRICT,
  "canonicalProductId" UUID NOT NULL REFERENCES "bill_products"("id") ON DELETE RESTRICT,
  "verifiedByUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "evidence" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "bill_equivalence_offer_time_idx" ON "bill_offer_equivalence_verifications"("providerOfferId","createdAt");
CREATE INDEX "bill_equivalence_product_time_idx" ON "bill_offer_equivalence_verifications"("canonicalProductId","createdAt");

CREATE TABLE "feature_flags" (
  "key" VARCHAR(120) PRIMARY KEY,
  "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "public" BOOLEAN NOT NULL DEFAULT FALSE,
  "description" VARCHAR(500),
  "config" JSONB,
  "updatedByUserId" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "feature_flags_public_enabled_idx" ON "feature_flags"("public","enabled");

CREATE TABLE "brand_configurations" (
  "key" VARCHAR(80) PRIMARY KEY DEFAULT 'default',
  "productName" VARCHAR(120) NOT NULL DEFAULT 'TwiPay',
  "legalName" VARCHAR(180) NOT NULL DEFAULT 'Octalve Ltd',
  "domain" VARCHAR(255) NOT NULL DEFAULT 'twipay.co',
  "supportEmail" VARCHAR(320) NOT NULL DEFAULT 'support@twipay.co',
  "logoUrl" VARCHAR(1000),
  "primaryColor" CHAR(7) NOT NULL DEFAULT '#5B2A86',
  "accentColor" CHAR(7) NOT NULL DEFAULT '#C59A35',
  "privacyUrl" VARCHAR(1000),
  "termsUrl" VARCHAR(1000),
  "metadata" JSONB,
  "updatedByUserId" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "brand_primary_color_check" CHECK ("primaryColor" ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT "brand_accent_color_check" CHECK ("accentColor" ~ '^#[0-9A-Fa-f]{6}$')
);

-- Seed only configuration/permission definitions. No privileged user assignment is created.
INSERT INTO "feature_flags"("key","enabled","public","description") VALUES
  ('services.utilities', TRUE, TRUE, 'Airtime, data, electricity and cable marketplace'),
  ('events.marketplace', TRUE, TRUE, 'Event discovery and ticket checkout'),
  ('events.refunds', FALSE, TRUE, 'Controlled event refund requests; enable only after MFA and finance approval controls are operationally verified'),
  ('operations.organizer_payouts', FALSE, FALSE, 'Organizer bank payouts; enable after live payout rails and finance roles are configured')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "brand_configurations"("key") VALUES ('default') ON CONFLICT ("key") DO NOTHING;

INSERT INTO "permissions"("id","code","description") VALUES
  (gen_random_uuid(),'ops.dashboard.read','View operational dashboard'),
  (gen_random_uuid(),'ops.disputes.review','Review customer disputes'),
  (gen_random_uuid(),'ops.compliance.read','View masked KYC/compliance queues and summaries'),
  (gen_random_uuid(),'ops.refunds.prepare','Prepare refund decisions'),
  (gen_random_uuid(),'ops.refunds.approve','Approve/refuse refund execution'),
  (gen_random_uuid(),'ops.payouts.prepare','Prepare organizer payouts'),
  (gen_random_uuid(),'ops.payouts.approve','Approve organizer payouts'),
  (gen_random_uuid(),'ops.providers.manage','Manage provider routing and circuit controls'),
  (gen_random_uuid(),'ops.catalog.map','Verify cross-provider bill SKU equivalence'),
  (gen_random_uuid(),'ops.feature_flags.manage','Manage product feature flags'),
  (gen_random_uuid(),'ops.branding.manage','Manage public product branding'),
  (gen_random_uuid(),'ops.reports.read','View operational and financial reports'),
  (gen_random_uuid(),'ops.audit.read','View operational audit history')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "roles"("id","code","name","description","system") VALUES
  (gen_random_uuid(),'SUPER_ADMIN','Super Admin','Full TwiPay administrative control',TRUE),
  (gen_random_uuid(),'OPERATIONS','Operations','Operational control without finance approval',TRUE),
  (gen_random_uuid(),'FINANCE_OPERATOR','Finance Operator','Prepares refunds and organizer payouts',TRUE),
  (gen_random_uuid(),'FINANCE_APPROVER','Finance Approver','Independent checker for outgoing money movements',TRUE),
  (gen_random_uuid(),'COMPLIANCE','Compliance','Dispute/compliance review and reporting',TRUE),
  (gen_random_uuid(),'AUDITOR','Auditor','Read-only audit/report access',TRUE)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions"("roleId","permissionId")
SELECT r."id", p."id" FROM "roles" r CROSS JOIN "permissions" p WHERE r."code"='SUPER_ADMIN'
ON CONFLICT DO NOTHING;
INSERT INTO "role_permissions"("roleId","permissionId")
SELECT r."id", p."id" FROM "roles" r JOIN "permissions" p ON p."code" IN ('ops.dashboard.read','ops.disputes.review','ops.providers.manage','ops.catalog.map','ops.reports.read') WHERE r."code"='OPERATIONS'
ON CONFLICT DO NOTHING;
INSERT INTO "role_permissions"("roleId","permissionId")
SELECT r."id", p."id" FROM "roles" r JOIN "permissions" p ON p."code" IN ('ops.dashboard.read','ops.refunds.prepare','ops.payouts.prepare','ops.reports.read') WHERE r."code"='FINANCE_OPERATOR'
ON CONFLICT DO NOTHING;
INSERT INTO "role_permissions"("roleId","permissionId")
SELECT r."id", p."id" FROM "roles" r JOIN "permissions" p ON p."code" IN ('ops.dashboard.read','ops.refunds.approve','ops.payouts.approve','ops.reports.read') WHERE r."code"='FINANCE_APPROVER'
ON CONFLICT DO NOTHING;
INSERT INTO "role_permissions"("roleId","permissionId")
SELECT r."id", p."id" FROM "roles" r JOIN "permissions" p ON p."code" IN ('ops.dashboard.read','ops.disputes.review','ops.compliance.read','ops.reports.read','ops.audit.read') WHERE r."code"='COMPLIANCE'
ON CONFLICT DO NOTHING;
INSERT INTO "role_permissions"("roleId","permissionId")
SELECT r."id", p."id" FROM "roles" r JOIN "permissions" p ON p."code" IN ('ops.dashboard.read','ops.compliance.read','ops.reports.read','ops.audit.read') WHERE r."code"='AUDITOR'
ON CONFLICT DO NOTHING;

-- Disputes are owned by the customer who owns the financial transaction.
CREATE OR REPLACE FUNCTION twipay_validate_dispute_insert() RETURNS trigger AS $$
DECLARE fin RECORD;
BEGIN
  SELECT * INTO fin FROM "financial_transactions" WHERE "id"=NEW."financialTransactionId";
  IF fin."id" IS NULL OR fin."userId" IS DISTINCT FROM NEW."userId" THEN RAISE EXCEPTION 'dispute financial transaction ownership mismatch'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "disputes_validate_insert" BEFORE INSERT ON "disputes" FOR EACH ROW EXECUTE FUNCTION twipay_validate_dispute_insert();

CREATE OR REPLACE FUNCTION twipay_guard_dispute_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'disputes cannot be deleted'; END IF;
  IF NEW."reference"<>OLD."reference" OR NEW."userId"<>OLD."userId" OR NEW."financialTransactionId"<>OLD."financialTransactionId"
    OR NEW."category"<>OLD."category" OR NEW."reasonCode"<>OLD."reasonCode" OR NEW."detailsCiphertext"<>OLD."detailsCiphertext" OR NEW."openedAt"<>OLD."openedAt"
  THEN RAISE EXCEPTION 'dispute instruction is immutable'; END IF;
  IF NEW."status"=OLD."status" THEN RETURN NEW; END IF;
  IF (OLD."status"='OPEN' AND NEW."status" IN ('UNDER_REVIEW','CANCELLED')) OR
     (OLD."status"='UNDER_REVIEW' AND NEW."status" IN ('APPROVED','REJECTED','RESOLVED')) OR
     (OLD."status" IN ('APPROVED','REJECTED') AND NEW."status"='RESOLVED')
  THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'invalid dispute state transition';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "disputes_guard_update" BEFORE UPDATE OR DELETE ON "disputes" FOR EACH ROW EXECUTE FUNCTION twipay_guard_dispute_mutation();

-- Batch 4 supports full refunds of successful internal EVENT_PURCHASE only.
CREATE OR REPLACE FUNCTION twipay_validate_refund_insert() RETURNS trigger AS $$
DECLARE fin RECORD;
BEGIN
  SELECT * INTO fin FROM "financial_transactions" WHERE "id"=NEW."originalFinancialTransactionId";
  IF fin."type"<>'EVENT_PURCHASE' OR fin."status"<>'SUCCEEDED' THEN RAISE EXCEPTION 'Batch 4 refund requires successful event purchase'; END IF;
  IF fin."userId" IS DISTINCT FROM NEW."requestedByUserId" OR fin."amountMinor"<>NEW."amountMinor" OR fin."currency"<>NEW."currency" THEN
    RAISE EXCEPTION 'refund request must exactly match original customer event purchase';
  END IF;
  IF EXISTS (SELECT 1 FROM "event_tickets" t JOIN "event_orders" o ON o."id"=t."orderId" WHERE o."financialTransactionId"=fin."id" AND t."status"='CHECKED_IN') THEN
    RAISE EXCEPTION 'checked-in event tickets cannot be refunded';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "refund_requests_validate_insert" BEFORE INSERT ON "refund_requests" FOR EACH ROW EXECUTE FUNCTION twipay_validate_refund_insert();

CREATE OR REPLACE FUNCTION twipay_guard_refund_mutation() RETURNS trigger AS $$
DECLARE rfin RECORD;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'refund requests cannot be deleted'; END IF;
  IF NEW."reference"<>OLD."reference" OR NEW."originalFinancialTransactionId"<>OLD."originalFinancialTransactionId" OR NEW."requestedByUserId"<>OLD."requestedByUserId"
     OR NEW."amountMinor"<>OLD."amountMinor" OR NEW."currency"<>OLD."currency" OR NEW."reasonCode"<>OLD."reasonCode" OR NEW."createdAt"<>OLD."createdAt"
  THEN RAISE EXCEPTION 'refund instruction is immutable'; END IF;
  IF OLD."refundFinancialTransactionId" IS NOT NULL AND NEW."refundFinancialTransactionId" IS DISTINCT FROM OLD."refundFinancialTransactionId" THEN
    RAISE EXCEPTION 'refund financial transaction cannot be replaced';
  END IF;
  IF NEW."approvedByUserId" IS NOT NULL AND NEW."reviewedByUserId" IS NOT NULL AND NEW."approvedByUserId"=NEW."reviewedByUserId" THEN
    RAISE EXCEPTION 'refund maker and checker must be different users';
  END IF;
  IF NEW."status"='SUCCEEDED' AND OLD."status"<>'SUCCEEDED' THEN
    IF NEW."refundFinancialTransactionId" IS NULL THEN RAISE EXCEPTION 'successful refund requires refund financial transaction'; END IF;
    SELECT * INTO rfin FROM "financial_transactions" WHERE "id"=NEW."refundFinancialTransactionId";
    IF rfin."type"<>'REFUND' OR rfin."status"<>'SUCCEEDED' OR rfin."amountMinor"<>NEW."amountMinor" OR rfin."currency"<>NEW."currency" THEN
      RAISE EXCEPTION 'refund financial transaction evidence mismatch';
    END IF;
  END IF;
  IF NEW."status"=OLD."status" THEN RETURN NEW; END IF;
  IF (OLD."status"='REQUESTED' AND NEW."status" IN ('UNDER_REVIEW','REJECTED')) OR
     (OLD."status"='UNDER_REVIEW' AND NEW."status" IN ('APPROVED','REJECTED')) OR
     (OLD."status"='APPROVED' AND NEW."status"='PROCESSING') OR
     (OLD."status"='PROCESSING' AND NEW."status" IN ('SUCCEEDED','FAILED','UNKNOWN')) OR
     (OLD."status"='UNKNOWN' AND NEW."status" IN ('PROCESSING','SUCCEEDED','FAILED'))
  THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'invalid refund state transition';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "refund_requests_guard_update" BEFORE UPDATE OR DELETE ON "refund_requests" FOR EACH ROW EXECUTE FUNCTION twipay_guard_refund_mutation();

-- Event order/ticket refund transitions are only legal after a succeeded refund workflow.
CREATE OR REPLACE FUNCTION twipay_guard_event_order_update() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'event orders cannot be deleted'; END IF;
  IF NEW."userId" <> OLD."userId" OR NEW."eventId" <> OLD."eventId" OR NEW."financialTransactionId" <> OLD."financialTransactionId"
     OR NEW."subtotalMinor" <> OLD."subtotalMinor" OR NEW."platformFeeMinor" <> OLD."platformFeeMinor"
     OR NEW."totalMinor" <> OLD."totalMinor" OR NEW."currency" <> OLD."currency" THEN
    RAISE EXCEPTION 'event order financial instruction is immutable';
  END IF;
  IF NEW."status" = 'PAID' AND OLD."status" <> 'PAID' AND NOT EXISTS (
    SELECT 1 FROM "financial_transactions" f WHERE f."id" = NEW."financialTransactionId" AND f."status" = 'SUCCEEDED'
  ) THEN RAISE EXCEPTION 'event order cannot become paid before financial settlement'; END IF;
  IF NEW."status"='REFUNDED' AND OLD."status"='PAID' AND NOT EXISTS (
    SELECT 1 FROM "refund_requests" r WHERE r."originalFinancialTransactionId"=NEW."financialTransactionId" AND r."status"='SUCCEEDED'
  ) THEN RAISE EXCEPTION 'event order refund requires succeeded refund workflow'; END IF;
  IF NEW."status" <> OLD."status" AND NOT (
    (OLD."status"='CREATED' AND NEW."status" IN ('FUNDS_RESERVED','FAILED','CANCELLED')) OR
    (OLD."status"='FUNDS_RESERVED' AND NEW."status" IN ('PAID','FAILED','CANCELLED')) OR
    (OLD."status"='PAID' AND NEW."status"='REFUNDED')
  ) THEN RAISE EXCEPTION 'invalid event order state transition'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION twipay_guard_ticket_update() RETURNS trigger AS $$
DECLARE ord RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'event tickets cannot be deleted'; END IF;
  IF NEW."publicCode" <> OLD."publicCode" OR NEW."orderId" <> OLD."orderId" OR NEW."ticketTypeId" <> OLD."ticketTypeId"
     OR NEW."credentialFingerprint" <> OLD."credentialFingerprint" OR NEW."credentialCiphertext" <> OLD."credentialCiphertext"
     OR NEW."credentialKeyVersion" <> OLD."credentialKeyVersion"
     OR NEW."issuedToName" IS DISTINCT FROM OLD."issuedToName" OR NEW."issuedToEmail" IS DISTINCT FROM OLD."issuedToEmail" THEN
    RAISE EXCEPTION 'ticket credential/instruction is immutable';
  END IF;
  IF NEW."status"='REFUNDED' AND OLD."status"='ACTIVE' THEN
    SELECT * INTO ord FROM "event_orders" WHERE "id"=NEW."orderId";
    IF ord."status"<>'REFUNDED' THEN RAISE EXCEPTION 'ticket refund requires refunded order'; END IF;
  END IF;
  IF NEW."status" <> OLD."status" AND NOT (
    OLD."status"='ACTIVE' AND NEW."status" IN ('CHECKED_IN','CANCELLED','REFUNDED','VOID')
  ) THEN RAISE EXCEPTION 'invalid ticket state transition'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Organizer payout reservations are represented by non-terminal payout rows.
CREATE OR REPLACE FUNCTION twipay_validate_organizer_payout_insert() RETURNS trigger AS $$
DECLARE org RECORD; ben RECORD;
BEGIN
  SELECT * INTO org FROM "event_organizers" WHERE "id"=NEW."organizerId" FOR UPDATE;
  SELECT * INTO ben FROM "beneficiaries" WHERE "id"=NEW."beneficiaryId";
  IF org."ownerUserId"<>NEW."requestedByUserId" THEN RAISE EXCEPTION 'organizer payout requester must own organizer'; END IF;
  IF ben."userId"<>org."ownerUserId" OR ben."currency"<>NEW."currency" THEN RAISE EXCEPTION 'organizer payout beneficiary ownership/currency mismatch'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "organizer_payouts_validate_insert" BEFORE INSERT ON "organizer_payouts" FOR EACH ROW EXECUTE FUNCTION twipay_validate_organizer_payout_insert();

CREATE OR REPLACE FUNCTION twipay_guard_organizer_payout_update() RETURNS trigger AS $$
DECLARE fin RECORD;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'organizer payouts cannot be deleted'; END IF;
  IF NEW."reference"<>OLD."reference" OR NEW."organizerId"<>OLD."organizerId" OR NEW."beneficiaryId"<>OLD."beneficiaryId"
     OR NEW."amountMinor"<>OLD."amountMinor" OR NEW."currency"<>OLD."currency" OR NEW."providerCode"<>OLD."providerCode" OR NEW."narration"<>OLD."narration"
     OR NEW."requestedByUserId"<>OLD."requestedByUserId" OR NEW."createdAt"<>OLD."createdAt" THEN
    RAISE EXCEPTION 'organizer payout instruction is immutable';
  END IF;
  IF OLD."financialTransactionId" IS NOT NULL AND NEW."financialTransactionId" IS DISTINCT FROM OLD."financialTransactionId" THEN RAISE EXCEPTION 'organizer payout financial transaction cannot be replaced'; END IF;
  IF OLD."providerOperationId" IS NOT NULL AND NEW."providerOperationId" IS DISTINCT FROM OLD."providerOperationId" THEN RAISE EXCEPTION 'organizer payout provider operation cannot be replaced'; END IF;
  IF NEW."approvedByUserId" IS NOT NULL AND NEW."preparedByUserId" IS NOT NULL AND NEW."approvedByUserId"=NEW."preparedByUserId" THEN RAISE EXCEPTION 'organizer payout maker and checker must be different users'; END IF;
  IF NEW."status" IN ('APPROVED','PROVIDER_SUBMITTED','PROCESSING','UNKNOWN','SUCCEEDED','REVERSED') THEN
    IF NEW."financialTransactionId" IS NULL THEN RAISE EXCEPTION 'approved organizer payout requires financial transaction'; END IF;
    SELECT * INTO fin FROM "financial_transactions" WHERE "id"=NEW."financialTransactionId";
    IF fin."type"<>'ORGANIZER_PAYOUT' OR fin."amountMinor"<>NEW."amountMinor" OR fin."currency"<>NEW."currency" THEN RAISE EXCEPTION 'organizer payout financial instruction mismatch'; END IF;
  END IF;
  IF NEW."status"=OLD."status" THEN RETURN NEW; END IF;
  IF (OLD."status"='REQUESTED' AND NEW."status" IN ('PENDING_APPROVAL','REJECTED')) OR
     (OLD."status"='PENDING_APPROVAL' AND NEW."status" IN ('APPROVED','REJECTED')) OR
     (OLD."status"='APPROVED' AND NEW."status"='PROVIDER_SUBMITTED') OR
     (OLD."status"='PROVIDER_SUBMITTED' AND NEW."status" IN ('PROCESSING','UNKNOWN','SUCCEEDED','FAILED','REVERSED')) OR
     (OLD."status"='PROCESSING' AND NEW."status" IN ('UNKNOWN','SUCCEEDED','FAILED','REVERSED')) OR
     (OLD."status"='UNKNOWN' AND NEW."status" IN ('PROCESSING','SUCCEEDED','FAILED','REVERSED')) OR
     (OLD."status"='SUCCEEDED' AND NEW."status"='REVERSED')
  THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'invalid organizer payout state transition';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "organizer_payouts_guard_update" BEFORE UPDATE OR DELETE ON "organizer_payouts" FOR EACH ROW EXECUTE FUNCTION twipay_guard_organizer_payout_update();

CREATE OR REPLACE FUNCTION twipay_operational_audit_immutable() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'operational audit events are append-only'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "operational_audit_events_immutable" BEFORE UPDATE OR DELETE ON "operational_audit_events" FOR EACH ROW EXECUTE FUNCTION twipay_operational_audit_immutable();

CREATE OR REPLACE FUNCTION twipay_equivalence_verification_immutable() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'bill offer equivalence verifications are append-only'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "bill_equivalence_verifications_immutable" BEFORE UPDATE OR DELETE ON "bill_offer_equivalence_verifications" FOR EACH ROW EXECUTE FUNCTION twipay_equivalence_verification_immutable();

CREATE OR REPLACE FUNCTION twipay_validate_bill_offer_remap() RETURNS trigger AS $$
BEGIN
  IF NEW."productId"<>OLD."productId" AND NOT EXISTS (
    SELECT 1 FROM "bill_offer_equivalence_verifications" v
    WHERE v."providerOfferId"=NEW."id" AND v."previousProductId"=OLD."productId" AND v."canonicalProductId"=NEW."productId"
  ) THEN RAISE EXCEPTION 'bill provider offer remap requires explicit equivalence verification'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "bill_provider_offers_remap_guard" BEFORE UPDATE OF "productId" ON "bill_provider_offers" FOR EACH ROW EXECUTE FUNCTION twipay_validate_bill_offer_remap();

CREATE OR REPLACE FUNCTION twipay_guard_feature_flag_delete() RETURNS trigger AS $$
BEGIN IF TG_OP='DELETE' THEN RAISE EXCEPTION 'feature flags cannot be deleted; disable them instead'; END IF; RETURN NEW; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "feature_flags_delete_guard" BEFORE DELETE ON "feature_flags" FOR EACH ROW EXECUTE FUNCTION twipay_guard_feature_flag_delete();

CREATE OR REPLACE FUNCTION twipay_guard_brand_delete() RETURNS trigger AS $$
BEGIN IF TG_OP='DELETE' THEN RAISE EXCEPTION 'brand configurations cannot be deleted'; END IF; RETURN NEW; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "brand_configurations_delete_guard" BEFORE DELETE ON "brand_configurations" FOR EACH ROW EXECUTE FUNCTION twipay_guard_brand_delete();

-- Batch 4 adds one tightly scoped internal REFUND settlement transition.
CREATE OR REPLACE FUNCTION twipay_guard_financial_transaction_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'TwiPay financial transactions cannot be deleted'; END IF;
  IF NEW."reference" <> OLD."reference" OR NEW."userId" IS DISTINCT FROM OLD."userId" OR NEW."type" <> OLD."type"
     OR NEW."currency" <> OLD."currency" OR NEW."amountMinor" <> OLD."amountMinor" OR NEW."feeMinor" <> OLD."feeMinor"
     OR NEW."description" IS DISTINCT FROM OLD."description" OR NEW."metadata" IS DISTINCT FROM OLD."metadata" OR NEW."createdAt" <> OLD."createdAt"
  THEN RAISE EXCEPTION 'TwiPay financial transaction instruction fields are immutable'; END IF;
  IF NEW."status" = OLD."status" THEN RETURN NEW; END IF;
  IF (OLD."status" = 'CREATED' AND NEW."status" IN ('AUTHORIZED','FAILED','CANCELLED')) OR
     (OLD."status" = 'AUTHORIZED' AND NEW."status" IN ('FUNDS_RESERVED','PROVIDER_SUBMITTED','FAILED','CANCELLED')) OR
     (OLD."status" = 'AUTHORIZED' AND NEW."status"='SUCCEEDED' AND OLD."type"='REFUND'
       AND EXISTS (SELECT 1 FROM "journal_transactions" j WHERE j."financialTransactionId"=OLD."id" AND j."postedAt" IS NOT NULL)) OR
     (OLD."status" = 'FUNDS_RESERVED' AND NEW."status" IN ('PROVIDER_SUBMITTED','FAILED','CANCELLED')) OR
     (OLD."status" = 'FUNDS_RESERVED' AND NEW."status"='SUCCEEDED' AND OLD."type"='EVENT_PURCHASE'
       AND EXISTS (SELECT 1 FROM "journal_transactions" j WHERE j."financialTransactionId"=OLD."id" AND j."postedAt" IS NOT NULL)) OR
     (OLD."status" = 'PROVIDER_SUBMITTED' AND NEW."status" IN ('PROCESSING','UNKNOWN','SUCCEEDED','FAILED','REVERSED')) OR
     (OLD."status" = 'PROCESSING' AND NEW."status" IN ('UNKNOWN','SUCCEEDED','FAILED','REVERSED')) OR
     (OLD."status" = 'UNKNOWN' AND NEW."status" IN ('PROCESSING','SUCCEEDED','FAILED','REVERSED')) OR
     (OLD."status" = 'SUCCEEDED' AND NEW."status"='REVERSED')
  THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Invalid TwiPay financial transaction transition % -> %', OLD."status", NEW."status";
END;
$$ LANGUAGE plpgsql;

-- Sellability/licensing foundation. This is local deployment configuration,
-- not remote phone-home DRM; licensed installations remain standalone.
CREATE TABLE "deployment_profiles" (
  "key" varchar(80) PRIMARY KEY,
  "productSlug" varchar(120) NOT NULL,
  "edition" varchar(40) NOT NULL,
  "licensedTo" varchar(180) NOT NULL,
  "status" varchar(30) NOT NULL,
  "allowedModules" jsonb,
  "supportMode" varchar(40) NOT NULL,
  "licenseReference" varchar(160),
  "validUntil" timestamptz(6),
  "updatedByUserId" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "createdAt" timestamptz(6) NOT NULL DEFAULT now(),
  "updatedAt" timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT "deployment_profiles_edition_check" CHECK ("edition" IN ('TWIPAY_OWNED','WHITE_LABEL','ENTERPRISE_SOURCE')),
  CONSTRAINT "deployment_profiles_status_check" CHECK ("status" IN ('ACTIVE','SUSPENDED','EXPIRED')),
  CONSTRAINT "deployment_profiles_support_mode_check" CHECK ("supportMode" IN ('SELF_MANAGED','OCTALVE_MANAGED','ENTERPRISE_SUPPORT'))
);

INSERT INTO "deployment_profiles" ("key","productSlug","edition","licensedTo","status","allowedModules","supportMode")
VALUES ('default','twipay','TWIPAY_OWNED','Octalve Ltd','ACTIVE','["wallet","utilities","events"]'::jsonb,'OCTALVE_MANAGED')
ON CONFLICT ("key") DO NOTHING;

CREATE OR REPLACE FUNCTION twipay_prevent_deployment_profile_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'deployment profile cannot be deleted; suspend or replace configuration through an audited change';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER deployment_profiles_no_delete BEFORE DELETE ON "deployment_profiles" FOR EACH ROW EXECUTE FUNCTION twipay_prevent_deployment_profile_delete();

-- Event check-in delegation is intentionally narrow: assignment to a specific
-- event does not grant organizer settlement, payout, or general operations access.
CREATE TYPE "EventStaffRole" AS ENUM ('CHECK_IN');
CREATE TYPE "EventStaffStatus" AS ENUM ('ACTIVE','REVOKED');
CREATE TABLE "event_staff_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "eventId" uuid NOT NULL REFERENCES "events"("id") ON DELETE RESTRICT,
  "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "role" "EventStaffRole" NOT NULL DEFAULT 'CHECK_IN',
  "status" "EventStaffStatus" NOT NULL DEFAULT 'ACTIVE',
  "invitedByUserId" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "createdAt" timestamptz(6) NOT NULL DEFAULT now(),
  "updatedAt" timestamptz(6) NOT NULL DEFAULT now(),
  UNIQUE ("eventId","userId","role")
);
CREATE INDEX "event_staff_user_status_idx" ON "event_staff_assignments"("userId","status");
CREATE INDEX "event_staff_event_status_role_idx" ON "event_staff_assignments"("eventId","status","role");
CREATE OR REPLACE FUNCTION twipay_guard_event_staff_assignment() RETURNS trigger AS $$
DECLARE org_owner uuid;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'event staff assignments cannot be deleted; revoke them instead'; END IF;
  IF TG_OP='INSERT' THEN
    SELECT o."ownerUserId" INTO org_owner FROM "events" e JOIN "event_organizers" o ON o."id"=e."organizerId" WHERE e."id"=NEW."eventId";
    IF org_owner IS NULL OR org_owner<>NEW."invitedByUserId" THEN RAISE EXCEPTION 'event staff assignment must be made by organizer owner'; END IF;
    RETURN NEW;
  END IF;
  IF NEW."eventId"<>OLD."eventId" OR NEW."userId"<>OLD."userId" OR NEW."role"<>OLD."role" OR NEW."invitedByUserId"<>OLD."invitedByUserId" OR NEW."createdAt"<>OLD."createdAt" THEN RAISE EXCEPTION 'event staff assignment instruction is immutable'; END IF;
  IF OLD."status"='ACTIVE' AND NEW."status"='REVOKED' THEN RETURN NEW; END IF;
  IF NEW."status"=OLD."status" THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'invalid event staff assignment transition';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "event_staff_assignments_guard" BEFORE INSERT OR UPDATE OR DELETE ON "event_staff_assignments" FOR EACH ROW EXECUTE FUNCTION twipay_guard_event_staff_assignment();
