-- Phase 5.3: independently owned, encrypted customer-support conversations.
-- No finance/ledger/provider schema mutation; no unscanned file uploads.
CREATE TABLE "support_cases" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "reference" VARCHAR(100) NOT NULL UNIQUE,
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "requestKey" UUID NOT NULL UNIQUE,
  "category" VARCHAR(32) NOT NULL,
  "subjectCiphertext" TEXT NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'WAITING_SUPPORT',
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "support_case_status_check" CHECK ("status" IN ('WAITING_SUPPORT','WAITING_CUSTOMER','CLOSED')),
  CONSTRAINT "support_case_category_check" CHECK ("category" IN ('GENERAL','ACCOUNT','EVENTS','TECHNICAL'))
);
CREATE INDEX "support_cases_user_updated_idx" ON "support_cases"("userId","updatedAt");
CREATE INDEX "support_cases_status_updated_idx" ON "support_cases"("status","updatedAt");
CREATE TABLE "support_messages" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "caseId" UUID NOT NULL REFERENCES "support_cases"("id") ON DELETE RESTRICT,
  "authorUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "authorType" VARCHAR(12) NOT NULL,
  "requestKey" UUID NOT NULL UNIQUE,
  "bodyCiphertext" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "support_message_author_check" CHECK ("authorType" IN ('CUSTOMER','STAFF'))
);
CREATE INDEX "support_messages_case_created_idx" ON "support_messages"("caseId","createdAt");
-- Messages and author identity cannot be retrospectively edited or removed.
CREATE OR REPLACE FUNCTION twipay_support_message_immutable() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'support messages are immutable'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "support_message_append_only" BEFORE UPDATE OR DELETE ON "support_messages"
FOR EACH ROW EXECUTE FUNCTION twipay_support_message_immutable();
CREATE OR REPLACE FUNCTION twipay_support_closed_terminal() RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'CLOSED' AND NEW."status" IS DISTINCT FROM 'CLOSED' THEN
    RAISE EXCEPTION 'closed support cases cannot be reopened without approved procedure';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "support_case_closed_terminal" BEFORE UPDATE ON "support_cases"
FOR EACH ROW EXECUTE FUNCTION twipay_support_closed_terminal();
INSERT INTO "permissions"("id","code","description") VALUES
  (gen_random_uuid(),'ops.support.read','Read customer support queue and encrypted conversation under authorization'),
  (gen_random_uuid(),'ops.support.reply','Reply to and close customer support cases with MFA')
ON CONFLICT ("code") DO NOTHING;
INSERT INTO "role_permissions"("roleId","permissionId")
SELECT r."id",p."id" FROM "roles" r JOIN "permissions" p ON
 (r."code"='SUPER_ADMIN' AND p."code" IN ('ops.support.read','ops.support.reply')) OR
 (r."code"='OPERATIONS' AND p."code" IN ('ops.support.read','ops.support.reply')) OR
 (r."code"='COMPLIANCE' AND p."code"='ops.support.read')
ON CONFLICT DO NOTHING;
