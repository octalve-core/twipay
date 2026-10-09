-- Phase 5.4: owner-scoped, persisted notification inbox and optional delivery choices.
-- Never mirror credential recovery codes, email bodies or arbitrary provider content into inbox items.
ALTER TABLE "notifications" ADD COLUMN "deliverySuppressed" BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE "notification_preferences" (
  "userId" UUID NOT NULL PRIMARY KEY REFERENCES "users"("id") ON DELETE RESTRICT,
  "supportInApp" BOOLEAN NOT NULL DEFAULT TRUE,
  "eventInApp" BOOLEAN NOT NULL DEFAULT TRUE,
  "supportEmail" BOOLEAN NOT NULL DEFAULT TRUE,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW()
);
CREATE TABLE "notification_inbox_items" (
  "id" UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "notificationId" UUID NOT NULL UNIQUE REFERENCES "notifications"("id") ON DELETE RESTRICT,
  "category" VARCHAR(24) NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "message" VARCHAR(240) NOT NULL,
  "targetPath" VARCHAR(180) NOT NULL,
  "readAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "inbox_category_check" CHECK ("category" IN ('SECURITY','SUPPORT','EVENTS')),
  CONSTRAINT "inbox_target_check" CHECK ("targetPath" IN ('/dashboard/settings/security-overview','/dashboard/settings/support-centre','/dashboard/my-tickets'))
);
CREATE INDEX "notification_inbox_user_created_idx" ON "notification_inbox_items"("userId","createdAt","id");
CREATE INDEX "notification_inbox_user_read_idx" ON "notification_inbox_items"("userId","readAt");
INSERT INTO "permissions"("id","code","description")
 VALUES(gen_random_uuid(),'ops.notifications.read','Read aggregate delivery status without customer content')
 ON CONFLICT("code") DO NOTHING;
INSERT INTO "role_permissions"("roleId","permissionId")
SELECT r."id",p."id" FROM "roles" r JOIN "permissions" p ON
(r."code" IN ('SUPER_ADMIN','OPERATIONS','COMPLIANCE') AND p."code"='ops.notifications.read')
ON CONFLICT DO NOTHING;
