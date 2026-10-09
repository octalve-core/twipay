-- Ephemeral OIDC state: hashes and encrypted verifier, no wallet/financial schema changes.
CREATE TABLE "google_oidc_transactions" (
 "id" UUID NOT NULL,
 "stateHash" CHAR(64) NOT NULL,
 "bindingHash" CHAR(64) NOT NULL,
 "verifierCiphertext" TEXT NOT NULL,
 "nonce" VARCHAR(255) NOT NULL,
 "purpose" VARCHAR(12) NOT NULL,
 "userId" UUID,
 "sessionId" UUID,
 "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMPTZ(6) NOT NULL,
 "consumedAt" TIMESTAMPTZ(6),
 CONSTRAINT "google_oidc_transactions_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "google_oidc_transactions_purpose_check" CHECK ("purpose" IN ('SIGN_IN', 'LINK')),
 CONSTRAINT "google_oidc_transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "google_oidc_transactions_stateHash_key" ON "google_oidc_transactions"("stateHash");
CREATE INDEX "google_oidc_transactions_expiresAt_idx" ON "google_oidc_transactions"("expiresAt");
