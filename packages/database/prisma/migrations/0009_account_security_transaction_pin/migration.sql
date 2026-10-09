-- Phase 3.4: additive security credentials only. Never alter balances, wallet/ledger or financial controls.
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'PASSWORD_ENROLLMENT_REQUESTED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'PASSWORD_ENROLLED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'TRANSACTION_PIN_SET';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'TRANSACTION_PIN_CHANGED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'TRANSACTION_PIN_FAILED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'TRANSACTION_PIN_LOCKED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'TRANSACTION_PIN_RESET_REQUESTED';
ALTER TYPE "SecurityEventType" ADD VALUE IF NOT EXISTS 'TRANSACTION_PIN_RESET';

CREATE TABLE "transaction_pin_credentials" (
 "userId" UUID NOT NULL PRIMARY KEY REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "pinHash" TEXT NOT NULL,
 "failedAttempts" INTEGER NOT NULL DEFAULT 0,
 "lockedUntil" TIMESTAMPTZ(6),
 "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "changedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "transaction_pin_failedAttempts_check" CHECK ("failedAttempts" >= 0 AND "failedAttempts" <= 5)
);
CREATE TABLE "password_enrollment_challenges" (
 "id" UUID NOT NULL PRIMARY KEY,
 "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "sessionId" UUID NOT NULL,
 "email" VARCHAR(320) NOT NULL,
 "codeHash" CHAR(64) NOT NULL,
 "failedAttempts" INTEGER NOT NULL DEFAULT 0,
 "expiresAt" TIMESTAMPTZ(6) NOT NULL,
 "consumedAt" TIMESTAMPTZ(6),
 "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "password_enrollment_failedAttempts_check" CHECK ("failedAttempts" >= 0 AND "failedAttempts" <= 5)
);
CREATE INDEX "password_enrollment_challenges_userId_createdAt_idx" ON "password_enrollment_challenges"("userId", "createdAt");
CREATE INDEX "password_enrollment_challenges_expiresAt_idx" ON "password_enrollment_challenges"("expiresAt");
CREATE TABLE "transaction_pin_reset_challenges" (
 "id" UUID NOT NULL PRIMARY KEY,
 "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "sessionId" UUID NOT NULL,
 "email" VARCHAR(320) NOT NULL,
 "codeHash" CHAR(64) NOT NULL,
 "failedAttempts" INTEGER NOT NULL DEFAULT 0,
 "expiresAt" TIMESTAMPTZ(6) NOT NULL,
 "consumedAt" TIMESTAMPTZ(6),
 "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "transaction_pin_reset_failedAttempts_check" CHECK ("failedAttempts" >= 0 AND "failedAttempts" <= 5)
);
CREATE INDEX "transaction_pin_reset_challenges_userId_createdAt_idx" ON "transaction_pin_reset_challenges"("userId", "createdAt");
CREATE INDEX "transaction_pin_reset_challenges_expiresAt_idx" ON "transaction_pin_reset_challenges"("expiresAt");
