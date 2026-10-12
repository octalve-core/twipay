-- Phase 4.6: auditable maker/checker exception notes; NEVER changes journals or holds.
ALTER TABLE "reconciliation_cases"
  ADD COLUMN "reviewPreparedByUserId" UUID REFERENCES "users"("id") ON DELETE RESTRICT,
  ADD COLUMN "reviewPreparedAt" TIMESTAMPTZ(6),
  ADD COLUMN "reviewNote" VARCHAR(1200),
  ADD COLUMN "reviewCheckedByUserId" UUID REFERENCES "users"("id") ON DELETE RESTRICT,
  ADD COLUMN "reviewCheckedAt" TIMESTAMPTZ(6);
ALTER TABLE "reconciliation_cases" ADD CONSTRAINT "reconciliation_independent_reviewers"
  CHECK ("reviewPreparedByUserId" IS NULL OR "reviewCheckedByUserId" IS NULL OR "reviewPreparedByUserId" <> "reviewCheckedByUserId");
INSERT INTO "permissions"("id","code","description") VALUES
  (gen_random_uuid(),'ops.reconciliation.read','View masked financial exception and pending hold review queue'),
  (gen_random_uuid(),'ops.reconciliation.prepare','Prepare a financial reconciliation exception note'),
  (gen_random_uuid(),'ops.reconciliation.approve','Independently close verified status-only exception')
ON CONFLICT ("code") DO NOTHING;
INSERT INTO "role_permissions"("roleId","permissionId")
SELECT r."id",p."id" FROM "roles" r JOIN "permissions" p ON
 (r."code"='SUPER_ADMIN' AND p."code" LIKE 'ops.reconciliation.%') OR
 (r."code" IN ('OPERATIONS','FINANCE_OPERATOR','COMPLIANCE','AUDITOR') AND p."code"='ops.reconciliation.read') OR
 (r."code"='FINANCE_OPERATOR' AND p."code"='ops.reconciliation.prepare') OR
 (r."code"='FINANCE_APPROVER' AND p."code" IN ('ops.reconciliation.read','ops.reconciliation.approve'))
ON CONFLICT DO NOTHING;
-- Prevent direct SQL bypass of the independent-review rule for new manual closures.
CREATE OR REPLACE FUNCTION twipay_guard_manual_reconciliation_resolution() RETURNS trigger AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW."status"='RESOLVED' THEN RAISE EXCEPTION 'reconciliation cases cannot be inserted resolved'; END IF;
    RETURN NEW;
  END IF;
  IF OLD."reviewPreparedByUserId" IS NOT NULL AND (
      NEW."reviewPreparedByUserId" IS DISTINCT FROM OLD."reviewPreparedByUserId" OR
      NEW."reviewPreparedAt" IS DISTINCT FROM OLD."reviewPreparedAt" OR
      NEW."reviewNote" IS DISTINCT FROM OLD."reviewNote") THEN
    RAISE EXCEPTION 'prepared reconciliation evidence is immutable';
  END IF;
  IF OLD."reviewCheckedByUserId" IS NOT NULL AND (
      NEW."reviewCheckedByUserId" IS DISTINCT FROM OLD."reviewCheckedByUserId" OR
      NEW."reviewCheckedAt" IS DISTINCT FROM OLD."reviewCheckedAt" OR
      NEW."resolution" IS DISTINCT FROM OLD."resolution" OR
      NEW."resolvedAt" IS DISTINCT FROM OLD."resolvedAt") THEN
    RAISE EXCEPTION 'approved reconciliation evidence is immutable';
  END IF;
  IF OLD."status"='RESOLVED' AND NEW."status" IS DISTINCT FROM 'RESOLVED' THEN
    RAISE EXCEPTION 'approved reconciliation case cannot be reopened by status mutation';
  END IF;
  IF NEW."status"='RESOLVED' AND OLD."status" IS DISTINCT FROM 'RESOLVED' THEN
    IF NEW."reviewPreparedByUserId" IS NULL OR NEW."reviewCheckedByUserId" IS NULL OR
       NEW."reviewPreparedByUserId"=NEW."reviewCheckedByUserId" OR NEW."reviewNote" IS NULL OR
       NEW."reviewPreparedAt" IS NULL OR NEW."reviewCheckedAt" IS NULL THEN
      RAISE EXCEPTION 'reconciliation closure requires independent prepared review';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "reconciliation_independent_close"
  BEFORE INSERT OR UPDATE ON "reconciliation_cases" FOR EACH ROW
  EXECUTE FUNCTION twipay_guard_manual_reconciliation_resolution();
