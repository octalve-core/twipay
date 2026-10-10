-- Phase 6.3B: limited, independently approved owner-admin staff grants.
-- Deliberately no self-service SUPER_ADMIN, financial permissions, customer balances or provider activation.
CREATE TYPE "OwnerStaffReviewStatus" AS ENUM ('PREPARED','APPROVED','REJECTED');
CREATE TYPE "OwnerStaffReviewAction" AS ENUM ('GRANT','REVOKE');
CREATE TABLE "owner_staff_reviews" (
 "id" UUID PRIMARY KEY,
 "targetUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
 "roleCode" VARCHAR(80) NOT NULL,
 "action" "OwnerStaffReviewAction" NOT NULL,
 "status" "OwnerStaffReviewStatus" NOT NULL DEFAULT 'PREPARED',
 "preparedByUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
 "checkedByUserId" UUID REFERENCES "users"("id") ON DELETE RESTRICT,
 "checkedAt" TIMESTAMPTZ(6),
 "reason" VARCHAR(500) NOT NULL,
 "rejectionReason" VARCHAR(500),
 "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "owner_staff_role_allowlist" CHECK ("roleCode" IN ('SUPPORT_AGENT','AUDITOR','COMPLIANCE')),
 CONSTRAINT "owner_staff_maker_not_target" CHECK ("preparedByUserId"<>"targetUserId"),
 CONSTRAINT "owner_staff_checker_independent" CHECK ("checkedByUserId" IS NULL OR ("checkedByUserId"<>"preparedByUserId" AND "checkedByUserId"<>"targetUserId")),
 CONSTRAINT "owner_staff_terminal_evidence" CHECK (
   ("status"='PREPARED' AND "checkedByUserId" IS NULL AND "checkedAt" IS NULL AND "rejectionReason" IS NULL) OR
   ("status"='APPROVED' AND "checkedByUserId" IS NOT NULL AND "checkedAt" IS NOT NULL AND "rejectionReason" IS NULL) OR
   ("status"='REJECTED' AND "checkedByUserId" IS NOT NULL AND "checkedAt" IS NOT NULL AND "rejectionReason" IS NOT NULL))
);
CREATE INDEX "owner_staff_reviews_status_createdAt_idx" ON "owner_staff_reviews"("status","createdAt");
CREATE INDEX "owner_staff_reviews_targetUserId_createdAt_idx" ON "owner_staff_reviews"("targetUserId","createdAt");
CREATE UNIQUE INDEX "one_pending_staff_change_per_role" ON "owner_staff_reviews"("targetUserId","roleCode") WHERE "status"='PREPARED';
CREATE OR REPLACE FUNCTION twipay_guard_owner_staff_review() RETURNS trigger AS $$
BEGIN
  IF OLD."status"<>'PREPARED' OR NEW."id" IS DISTINCT FROM OLD."id" OR
    NEW."targetUserId" IS DISTINCT FROM OLD."targetUserId" OR NEW."roleCode" IS DISTINCT FROM OLD."roleCode" OR
    NEW."action" IS DISTINCT FROM OLD."action" OR NEW."preparedByUserId" IS DISTINCT FROM OLD."preparedByUserId" OR
    NEW."reason" IS DISTINCT FROM OLD."reason" THEN
    RAISE EXCEPTION 'owner staff review evidence is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "owner_staff_review_immutable" BEFORE UPDATE ON "owner_staff_reviews"
 FOR EACH ROW EXECUTE FUNCTION twipay_guard_owner_staff_review();
INSERT INTO "roles"("id","code","name","description","system") VALUES
 (gen_random_uuid(),'SUPPORT_AGENT','Support Agent','Limited customer support role, no financial permission',TRUE)
ON CONFLICT ("code") DO NOTHING;
INSERT INTO "permissions"("id","code","description") VALUES
 (gen_random_uuid(),'ops.owner.read','Owner-only business visibility'),
 (gen_random_uuid(),'ops.owner.staff.prepare','Prepare limited staff-role changes'),
 (gen_random_uuid(),'ops.owner.staff.approve','Independently review limited staff-role changes')
ON CONFLICT ("code") DO NOTHING;
INSERT INTO "role_permissions"("roleId","permissionId")
SELECT r."id",p."id" FROM "roles" r CROSS JOIN "permissions" p
WHERE (r."code"='SUPER_ADMIN' AND p."code" LIKE 'ops.owner.%')
   OR (r."code"='SUPPORT_AGENT' AND p."code" IN ('ops.support.read','ops.support.reply'))
ON CONFLICT DO NOTHING;
-- No user receives any role as a result of this migration.

-- Separately reviewed customer account suspension only. No balance changes, wallet hold release or auto-reinstatement.
CREATE TABLE "owner_customer_suspension_reviews" (
 "id" UUID PRIMARY KEY,
 "targetUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
 "status" "OwnerStaffReviewStatus" NOT NULL DEFAULT 'PREPARED',
 "preparedByUserId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
 "checkedByUserId" UUID REFERENCES "users"("id") ON DELETE RESTRICT,
 "checkedAt" TIMESTAMPTZ(6),
 "reason" VARCHAR(500) NOT NULL,
 "rejectionReason" VARCHAR(500),
 "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "owner_suspension_maker_independent" CHECK ("preparedByUserId"<>"targetUserId"),
 CONSTRAINT "owner_suspension_checker_independent" CHECK ("checkedByUserId" IS NULL OR ("checkedByUserId"<>"preparedByUserId" AND "checkedByUserId"<>"targetUserId")),
 CONSTRAINT "owner_suspension_terminal_evidence" CHECK (
   ("status"='PREPARED' AND "checkedByUserId" IS NULL AND "checkedAt" IS NULL AND "rejectionReason" IS NULL) OR
   ("status"='APPROVED' AND "checkedByUserId" IS NOT NULL AND "checkedAt" IS NOT NULL AND "rejectionReason" IS NULL) OR
   ("status"='REJECTED' AND "checkedByUserId" IS NOT NULL AND "checkedAt" IS NOT NULL AND "rejectionReason" IS NOT NULL))
);
CREATE INDEX "owner_customer_suspensions_status_createdAt_idx" ON "owner_customer_suspension_reviews"("status","createdAt");
CREATE INDEX "owner_customer_suspensions_targetUserId_createdAt_idx" ON "owner_customer_suspension_reviews"("targetUserId","createdAt");
CREATE UNIQUE INDEX "one_pending_suspension_per_customer" ON "owner_customer_suspension_reviews"("targetUserId") WHERE "status"='PREPARED';
CREATE OR REPLACE FUNCTION twipay_guard_owner_suspension_review() RETURNS trigger AS $$
BEGIN
  IF OLD."status"<>'PREPARED' OR NEW."id" IS DISTINCT FROM OLD."id" OR
     NEW."targetUserId" IS DISTINCT FROM OLD."targetUserId" OR
     NEW."preparedByUserId" IS DISTINCT FROM OLD."preparedByUserId" OR
     NEW."reason" IS DISTINCT FROM OLD."reason" THEN
    RAISE EXCEPTION 'customer suspension review evidence is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "owner_customer_suspension_review_immutable" BEFORE UPDATE ON "owner_customer_suspension_reviews"
 FOR EACH ROW EXECUTE FUNCTION twipay_guard_owner_suspension_review();
-- These tables contain approval evidence only; customer access changes happen via the reviewed service.
