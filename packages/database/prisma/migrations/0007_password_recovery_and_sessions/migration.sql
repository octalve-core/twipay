-- Additive credential recovery state; no wallet, ledger, provider or session schema changes.
CREATE TABLE "password_reset_challenges" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "codeHash" CHAR(64) NOT NULL,
  "failedAttempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "consumedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_challenges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "password_reset_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "password_reset_challenges_failedAttempts_check" CHECK ("failedAttempts" >= 0 AND "failedAttempts" <= 5)
);
CREATE INDEX "password_reset_challenges_userId_createdAt_idx" ON "password_reset_challenges"("userId", "createdAt");
CREATE INDEX "password_reset_challenges_expiresAt_idx" ON "password_reset_challenges"("expiresAt");
