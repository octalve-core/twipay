-- Batch 2 financial core migration.
-- This migration is intentionally defensive: ledger rows are append-only and
-- PostgreSQL re-validates balance/currency invariants at commit time.

CREATE TYPE "LedgerAccountCategory" AS ENUM ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE');
CREATE TYPE "LedgerNormalBalance" AS ENUM ('DEBIT','CREDIT');
CREATE TYPE "LedgerAccountStatus" AS ENUM ('ACTIVE','FROZEN','CLOSED');
CREATE TYPE "JournalEntrySide" AS ENUM ('DEBIT','CREDIT');
CREATE TYPE "WalletStatus" AS ENUM ('ACTIVE','RESTRICTED','FROZEN','CLOSED');
CREATE TYPE "WalletHoldStatus" AS ENUM ('ACTIVE','CAPTURED','RELEASED','EXPIRED');
CREATE TYPE "FinancialTransactionType" AS ENUM ('FUNDING','TRANSFER','BILL_PAYMENT','EVENT_PURCHASE','REFUND','REVERSAL','FEE','ADJUSTMENT');
CREATE TYPE "FinancialTransactionStatus" AS ENUM ('CREATED','AUTHORIZED','FUNDS_RESERVED','PROVIDER_SUBMITTED','PROCESSING','UNKNOWN','SUCCEEDED','FAILED','REVERSED','CANCELLED');
CREATE TYPE "ProviderOperationType" AS ENUM ('COLLECTION','VIRTUAL_ACCOUNT','PAYOUT','IDENTITY_CHECK');
CREATE TYPE "ProviderOperationStatus" AS ENUM ('PENDING','PROCESSING','REQUIRES_ACTION','SUCCEEDED','FAILED','REVERSED','UNKNOWN');
CREATE TYPE "IdempotencyStatus" AS ENUM ('PROCESSING','COMPLETED','FAILED');
CREATE TYPE "VirtualAccountStatus" AS ENUM ('PENDING','ACTIVE','INACTIVE','FAILED');
CREATE TYPE "BankTransferStatus" AS ENUM ('CREATED','VALIDATED','PROCESSING','UNKNOWN','SUCCEEDED','FAILED','REVERSED');
CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED','VERIFIED','PROCESSING','PROCESSED','FAILED','IGNORED');
CREATE TYPE "IdentityCheckType" AS ENUM ('BVN','NIN','BANK_ACCOUNT','CAC');
CREATE TYPE "IdentityCheckStatus" AS ENUM ('CREATED','AWAITING_CONSENT','PENDING','VERIFIED','FAILED','EXPIRED');
CREATE TYPE "ReconciliationCaseType" AS ENUM ('PROVIDER_STATUS_MISMATCH','AMOUNT_MISMATCH','MISSING_INTERNAL','MISSING_PROVIDER','DUPLICATE_EVENT','LEDGER_MISMATCH');
CREATE TYPE "ReconciliationCaseStatus" AS ENUM ('OPEN','AUTO_REPAIRED','NEEDS_REVIEW','RESOLVED','IGNORED');

CREATE TABLE "ledger_accounts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" VARCHAR(160) NOT NULL UNIQUE,
  "name" VARCHAR(160) NOT NULL,
  "category" "LedgerAccountCategory" NOT NULL,
  "normalBalance" "LedgerNormalBalance" NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "status" "LedgerAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "system" BOOLEAN NOT NULL DEFAULT FALSE,
  "ownerUserId" UUID REFERENCES "users"("id") ON DELETE RESTRICT,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ledger_accounts_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$')
);
CREATE INDEX "ledger_accounts_owner_currency_idx" ON "ledger_accounts"("ownerUserId","currency");
CREATE INDEX "ledger_accounts_category_currency_status_idx" ON "ledger_accounts"("category","currency","status");

CREATE TABLE "wallets" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "currency" CHAR(3) NOT NULL,
  "status" "WalletStatus" NOT NULL DEFAULT 'ACTIVE',
  "ledgerAccountId" UUID NOT NULL UNIQUE REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wallets_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  UNIQUE ("userId","currency")
);
CREATE INDEX "wallets_status_idx" ON "wallets"("status");

CREATE TABLE "financial_transactions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "reference" VARCHAR(80) NOT NULL UNIQUE,
  "userId" UUID REFERENCES "users"("id") ON DELETE SET NULL,
  "type" "FinancialTransactionType" NOT NULL,
  "status" "FinancialTransactionStatus" NOT NULL DEFAULT 'CREATED',
  "currency" CHAR(3) NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "feeMinor" BIGINT NOT NULL DEFAULT 0,
  "description" VARCHAR(255),
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_transactions_amount_positive" CHECK ("amountMinor" > 0),
  CONSTRAINT "financial_transactions_fee_nonnegative" CHECK ("feeMinor" >= 0),
  CONSTRAINT "financial_transactions_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$')
);
CREATE INDEX "financial_transactions_user_time_idx" ON "financial_transactions"("userId","createdAt");
CREATE INDEX "financial_transactions_status_time_idx" ON "financial_transactions"("status","createdAt");

CREATE TABLE "financial_transaction_state_changes" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "financialTransactionId" UUID NOT NULL REFERENCES "financial_transactions"("id") ON DELETE RESTRICT,
  "fromStatus" "FinancialTransactionStatus",
  "toStatus" "FinancialTransactionStatus" NOT NULL,
  "reason" VARCHAR(255),
  "actorType" VARCHAR(40) NOT NULL DEFAULT 'SYSTEM',
  "actorId" VARCHAR(100),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "financial_state_changes_tx_time_idx" ON "financial_transaction_state_changes"("financialTransactionId","createdAt");

CREATE TABLE "journal_transactions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "reference" VARCHAR(100) NOT NULL UNIQUE,
  "financialTransactionId" UUID REFERENCES "financial_transactions"("id") ON DELETE RESTRICT,
  "reversalOfId" UUID REFERENCES "journal_transactions"("id") ON DELETE RESTRICT,
  "currency" CHAR(3) NOT NULL,
  "description" VARCHAR(255),
  "metadata" JSONB,
  "postedAt" TIMESTAMPTZ(6),
  CONSTRAINT "journal_transactions_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$')
);
CREATE INDEX "journal_transactions_financial_tx_idx" ON "journal_transactions"("financialTransactionId");
ALTER TABLE "journal_transactions" ADD CONSTRAINT "journal_transactions_reversalOfId_key" UNIQUE ("reversalOfId");

CREATE TABLE "journal_entries" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "journalTransactionId" UUID NOT NULL REFERENCES "journal_transactions"("id") ON DELETE RESTRICT,
  "ledgerAccountId" UUID NOT NULL REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT,
  "sequence" INTEGER NOT NULL,
  "side" "JournalEntrySide" NOT NULL,
  "amountMinor" BIGINT NOT NULL,
  "memo" VARCHAR(255),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "journal_entries_amount_positive" CHECK ("amountMinor" > 0),
  UNIQUE ("journalTransactionId","sequence")
);
CREATE INDEX "journal_entries_account_time_idx" ON "journal_entries"("ledgerAccountId","createdAt");

CREATE TABLE "wallet_holds" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "walletId" UUID NOT NULL REFERENCES "wallets"("id") ON DELETE RESTRICT,
  "financialTransactionId" UUID NOT NULL REFERENCES "financial_transactions"("id") ON DELETE RESTRICT,
  "amountMinor" BIGINT NOT NULL,
  "status" "WalletHoldStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMPTZ(6),
  "capturedAt" TIMESTAMPTZ(6),
  "releasedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "wallet_holds_amount_positive" CHECK ("amountMinor" > 0),
  UNIQUE ("financialTransactionId","walletId")
);
CREATE INDEX "wallet_holds_wallet_status_idx" ON "wallet_holds"("walletId","status");

CREATE TABLE "idempotency_records" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "scope" VARCHAR(120) NOT NULL,
  "key" VARCHAR(128) NOT NULL,
  "requestHash" CHAR(64) NOT NULL,
  "status" "IdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
  "resourceType" VARCHAR(80),
  "resourceId" VARCHAR(100),
  "responseStatus" INTEGER,
  "responseBodyCiphertext" TEXT,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("userId","scope","key")
);
CREATE INDEX "idempotency_records_expiry_idx" ON "idempotency_records"("expiresAt");

CREATE TABLE "provider_operations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "financialTransactionId" UUID REFERENCES "financial_transactions"("id") ON DELETE RESTRICT,
  "userId" UUID REFERENCES "users"("id") ON DELETE RESTRICT,
  "type" "ProviderOperationType" NOT NULL,
  "providerCode" VARCHAR(40) NOT NULL,
  "merchantReference" VARCHAR(100) NOT NULL,
  "providerReference" VARCHAR(160),
  "status" "ProviderOperationStatus" NOT NULL DEFAULT 'PENDING',
  "rawStatus" VARCHAR(120),
  "requestHash" CHAR(64),
  "correlationKey" CHAR(64),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("providerCode","merchantReference")
);
ALTER TABLE "provider_operations" ADD CONSTRAINT "provider_operations_providerCode_type_providerReference_key" UNIQUE ("providerCode","type","providerReference");
CREATE INDEX "provider_operations_user_type_status_idx" ON "provider_operations"("userId","type","status");
CREATE INDEX "provider_operations_provider_type_correlation_idx" ON "provider_operations"("providerCode","type","correlationKey");
CREATE INDEX "provider_operations_provider_ref_idx" ON "provider_operations"("providerCode","providerReference");
CREATE INDEX "provider_operations_status_time_idx" ON "provider_operations"("status","createdAt");
CREATE UNIQUE INDEX "provider_operations_one_pending_va_per_user" ON "provider_operations"("userId","providerCode") WHERE "type" = 'VIRTUAL_ACCOUNT' AND "status" IN ('PENDING','PROCESSING','REQUIRES_ACTION','UNKNOWN');

CREATE TABLE "virtual_accounts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "providerCode" VARCHAR(40) NOT NULL,
  "providerAccountId" VARCHAR(160) NOT NULL,
  "accountReference" VARCHAR(100) NOT NULL,
  "accountNumberCiphertext" TEXT NOT NULL,
  "accountNumberFingerprint" CHAR(64) NOT NULL,
  "accountNumberLast4" VARCHAR(4) NOT NULL,
  "keyVersion" INTEGER NOT NULL DEFAULT 1,
  "accountName" VARCHAR(180) NOT NULL,
  "bankCode" VARCHAR(40),
  "bankName" VARCHAR(120) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "status" "VirtualAccountStatus" NOT NULL DEFAULT 'PENDING',
  "consentRecordedAt" TIMESTAMPTZ(6) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "virtual_accounts_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  UNIQUE ("providerCode","providerAccountId"),
  UNIQUE ("providerCode","accountReference"),
  UNIQUE ("providerCode","accountNumberFingerprint"),
  UNIQUE ("userId","providerCode","currency")
);
CREATE INDEX "virtual_accounts_user_status_idx" ON "virtual_accounts"("userId","status");

CREATE TABLE "beneficiaries" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "currency" CHAR(3) NOT NULL,
  "bankCode" VARCHAR(40) NOT NULL,
  "accountNumberCiphertext" TEXT NOT NULL,
  "accountNumberFingerprint" CHAR(64) NOT NULL,
  "accountNumberLast4" VARCHAR(4) NOT NULL,
  "keyVersion" INTEGER NOT NULL DEFAULT 1,
  "accountName" VARCHAR(180) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "beneficiaries_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  UNIQUE ("userId","bankCode","accountNumberFingerprint","currency")
);

CREATE TABLE "beneficiary_provider_references" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "beneficiaryId" UUID NOT NULL REFERENCES "beneficiaries"("id") ON DELETE CASCADE,
  "providerCode" VARCHAR(40) NOT NULL,
  "providerRef" VARCHAR(160) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("beneficiaryId","providerCode"),
  UNIQUE ("providerCode","providerRef")
);

CREATE TABLE "bank_transfers" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "financialTransactionId" UUID NOT NULL UNIQUE REFERENCES "financial_transactions"("id") ON DELETE RESTRICT,
  "beneficiaryId" UUID NOT NULL REFERENCES "beneficiaries"("id") ON DELETE RESTRICT,
  "status" "BankTransferStatus" NOT NULL DEFAULT 'CREATED',
  "narration" VARCHAR(160) NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "bank_transfers_beneficiary_time_idx" ON "bank_transfers"("beneficiaryId","createdAt");

CREATE TABLE "webhook_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "providerCode" VARCHAR(40) NOT NULL,
  "deduplicationKey" CHAR(64) NOT NULL,
  "externalEventId" VARCHAR(160),
  "eventType" VARCHAR(120) NOT NULL,
  "merchantReference" VARCHAR(100),
  "providerReference" VARCHAR(160),
  "payloadHash" CHAR(64) NOT NULL,
  "normalizedPayload" JSONB,
  "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
  "failureCode" VARCHAR(100),
  "receivedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMPTZ(6),
  UNIQUE ("providerCode","deduplicationKey")
);
CREATE INDEX "webhook_events_provider_external_idx" ON "webhook_events"("providerCode","externalEventId");
CREATE INDEX "webhook_events_status_time_idx" ON "webhook_events"("status","receivedAt");

CREATE TABLE "identity_verifications" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "type" "IdentityCheckType" NOT NULL,
  "status" "IdentityCheckStatus" NOT NULL DEFAULT 'CREATED',
  "providerCode" VARCHAR(40) NOT NULL,
  "merchantReference" VARCHAR(100) NOT NULL UNIQUE,
  "providerReference" VARCHAR(160),
  "identifierFingerprint" CHAR(64) NOT NULL,
  "identifierCiphertext" TEXT NOT NULL,
  "keyVersion" INTEGER NOT NULL DEFAULT 1,
  "identifierLast4" VARCHAR(4),
  "consentRecordedAt" TIMESTAMPTZ(6) NOT NULL,
  "result" JSONB,
  "expiresAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "identity_verifications_user_type_status_idx" ON "identity_verifications"("userId","type","status");
CREATE INDEX "identity_verifications_provider_ref_idx" ON "identity_verifications"("providerCode","providerReference");

CREATE TABLE "reconciliation_cases" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "type" "ReconciliationCaseType" NOT NULL,
  "status" "ReconciliationCaseStatus" NOT NULL DEFAULT 'OPEN',
  "financialTransactionId" UUID REFERENCES "financial_transactions"("id") ON DELETE RESTRICT,
  "providerOperationId" UUID REFERENCES "provider_operations"("id") ON DELETE RESTRICT,
  "summary" VARCHAR(255) NOT NULL,
  "evidence" JSONB,
  "resolution" JSONB,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMPTZ(6)
);
CREATE INDEX "reconciliation_cases_status_time_idx" ON "reconciliation_cases"("status","createdAt");
CREATE INDEX "reconciliation_cases_financial_tx_idx" ON "reconciliation_cases"("financialTransactionId");

-- The financial journal is append-only. Corrections are new reversing journals.
CREATE OR REPLACE FUNCTION twipay_reject_immutable_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'TwiPay immutable financial record cannot be updated or deleted: %', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- Journal headers may only transition once from OPEN (postedAt NULL) to SEALED.
-- Every other update/delete is rejected. Entries cannot be added after sealing.
CREATE OR REPLACE FUNCTION twipay_guard_journal_header_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'TwiPay journal transactions are append-only';
  END IF;

  IF OLD."postedAt" IS NULL
     AND NEW."postedAt" IS NOT NULL
     AND NEW."reference" = OLD."reference"
     AND NEW."financialTransactionId" IS NOT DISTINCT FROM OLD."financialTransactionId"
     AND NEW."reversalOfId" IS NOT DISTINCT FROM OLD."reversalOfId"
     AND NEW."currency" = OLD."currency"
     AND NEW."description" IS NOT DISTINCT FROM OLD."description"
     AND NEW."metadata" IS NOT DISTINCT FROM OLD."metadata"
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'TwiPay journal transactions are immutable after creation except for one-time sealing';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "journal_transactions_mutation_guard"
  BEFORE UPDATE OR DELETE ON "journal_transactions"
  FOR EACH ROW EXECUTE FUNCTION twipay_guard_journal_header_mutation();

CREATE OR REPLACE FUNCTION twipay_require_open_journal_insert() RETURNS trigger AS $$
BEGIN
  IF NEW."postedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'TwiPay journals must be created open and sealed only after entries balance';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "journal_insert_open_guard"
  BEFORE INSERT ON "journal_transactions"
  FOR EACH ROW EXECUTE FUNCTION twipay_require_open_journal_insert();

-- An OPEN journal may exist only inside the transaction that is constructing it.
-- This deferred constraint rejects a commit if the application forgot to seal it.
CREATE OR REPLACE FUNCTION twipay_require_journal_sealed_at_commit() RETURNS trigger AS $$
DECLARE
  seal_time TIMESTAMPTZ;
BEGIN
  SELECT "postedAt" INTO seal_time FROM "journal_transactions" WHERE "id" = NEW."id";
  IF seal_time IS NULL THEN
    RAISE EXCEPTION 'TwiPay journal % cannot commit while unsealed', NEW."id";
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "journal_sealed_commit_guard"
  AFTER INSERT ON "journal_transactions"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION twipay_require_journal_sealed_at_commit();

CREATE TRIGGER "journal_entries_immutable"
  BEFORE UPDATE OR DELETE ON "journal_entries"
  FOR EACH ROW EXECUTE FUNCTION twipay_reject_immutable_mutation();

CREATE TRIGGER "financial_state_changes_immutable"
  BEFORE UPDATE OR DELETE ON "financial_transaction_state_changes"
  FOR EACH ROW EXECUTE FUNCTION twipay_reject_immutable_mutation();

-- Every journal entry must use an account denominated in the journal currency,
-- and entries may only be inserted while the journal is OPEN.
CREATE OR REPLACE FUNCTION twipay_assert_entry_insertable() RETURNS trigger AS $$
DECLARE
  tx_currency CHAR(3);
  tx_posted_at TIMESTAMPTZ;
  account_currency CHAR(3);
BEGIN
  SELECT "currency", "postedAt" INTO tx_currency, tx_posted_at
  FROM "journal_transactions" WHERE "id" = NEW."journalTransactionId";
  SELECT "currency" INTO account_currency
  FROM "ledger_accounts" WHERE "id" = NEW."ledgerAccountId";

  IF tx_currency IS NULL OR account_currency IS NULL OR tx_currency <> account_currency THEN
    RAISE EXCEPTION 'Ledger account currency must match journal currency';
  END IF;
  IF tx_posted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot append entries to a sealed TwiPay journal';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "journal_entry_insert_guard"
  BEFORE INSERT ON "journal_entries"
  FOR EACH ROW EXECUTE FUNCTION twipay_assert_entry_insertable();

-- A journal can be sealed only when it has at least two entries and balances.
CREATE OR REPLACE FUNCTION twipay_assert_journal_balanced_before_seal() RETURNS trigger AS $$
DECLARE
  debit_total BIGINT;
  credit_total BIGINT;
  entry_count BIGINT;
BEGIN
  IF OLD."postedAt" IS NULL AND NEW."postedAt" IS NOT NULL THEN
    SELECT
      COALESCE(SUM(CASE WHEN "side" = 'DEBIT' THEN "amountMinor" ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN "side" = 'CREDIT' THEN "amountMinor" ELSE 0 END), 0),
      COUNT(*)
    INTO debit_total, credit_total, entry_count
    FROM "journal_entries"
    WHERE "journalTransactionId" = NEW."id";

    IF entry_count < 2 OR debit_total <> credit_total THEN
      RAISE EXCEPTION 'Unbalanced TwiPay journal %: entries %, debits %, credits %', NEW."id", entry_count, debit_total, credit_total;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "journal_balance_guard"
  BEFORE UPDATE OF "postedAt" ON "journal_transactions"
  FOR EACH ROW EXECUTE FUNCTION twipay_assert_journal_balanced_before_seal();

-- Holds are mutable only through their explicit one-way lifecycle; their amount
-- and ownership cannot be rewritten after creation.
CREATE OR REPLACE FUNCTION twipay_guard_wallet_hold_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'TwiPay wallet holds cannot be deleted';
  END IF;
  IF NEW."walletId" <> OLD."walletId"
     OR NEW."financialTransactionId" <> OLD."financialTransactionId"
     OR NEW."amountMinor" <> OLD."amountMinor"
     OR NEW."createdAt" <> OLD."createdAt"
  THEN
    RAISE EXCEPTION 'TwiPay wallet hold ownership/amount is immutable';
  END IF;
  IF NEW."status" <> OLD."status" THEN
    IF OLD."status" <> 'ACTIVE' OR NEW."status" NOT IN ('CAPTURED','RELEASED','EXPIRED') THEN
      RAISE EXCEPTION 'Invalid TwiPay wallet hold transition % -> %', OLD."status", NEW."status";
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "wallet_hold_mutation_guard"
  BEFORE UPDATE OR DELETE ON "wallet_holds"
  FOR EACH ROW EXECUTE FUNCTION twipay_guard_wallet_hold_mutation();

-- Financial instructions are immutable. Only the explicit status state machine
-- and ORM-maintained updatedAt timestamp may change after creation.
CREATE OR REPLACE FUNCTION twipay_guard_financial_transaction_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'TwiPay financial transactions cannot be deleted';
  END IF;

  IF NEW."reference" <> OLD."reference"
     OR NEW."userId" IS DISTINCT FROM OLD."userId"
     OR NEW."type" <> OLD."type"
     OR NEW."currency" <> OLD."currency"
     OR NEW."amountMinor" <> OLD."amountMinor"
     OR NEW."feeMinor" <> OLD."feeMinor"
     OR NEW."description" IS DISTINCT FROM OLD."description"
     OR NEW."metadata" IS DISTINCT FROM OLD."metadata"
     OR NEW."createdAt" <> OLD."createdAt"
  THEN
    RAISE EXCEPTION 'TwiPay financial transaction instruction fields are immutable';
  END IF;

  IF NEW."status" = OLD."status" THEN
    RETURN NEW;
  END IF;

  IF (OLD."status" = 'CREATED' AND NEW."status" IN ('AUTHORIZED','FAILED','CANCELLED'))
     OR (OLD."status" = 'AUTHORIZED' AND NEW."status" IN ('FUNDS_RESERVED','PROVIDER_SUBMITTED','FAILED','CANCELLED'))
     OR (OLD."status" = 'FUNDS_RESERVED' AND NEW."status" IN ('PROVIDER_SUBMITTED','FAILED','CANCELLED'))
     OR (OLD."status" = 'PROVIDER_SUBMITTED' AND NEW."status" IN ('PROCESSING','UNKNOWN','SUCCEEDED','FAILED','REVERSED'))
     OR (OLD."status" = 'PROCESSING' AND NEW."status" IN ('UNKNOWN','SUCCEEDED','FAILED','REVERSED'))
     OR (OLD."status" = 'UNKNOWN' AND NEW."status" IN ('PROCESSING','SUCCEEDED','FAILED','REVERSED'))
     OR (OLD."status" = 'SUCCEEDED' AND NEW."status" = 'REVERSED')
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Invalid TwiPay financial transaction transition % -> %', OLD."status", NEW."status";
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "financial_transactions_mutation_guard"
  BEFORE UPDATE OR DELETE ON "financial_transactions"
  FOR EACH ROW EXECUTE FUNCTION twipay_guard_financial_transaction_mutation();

-- A wallet must always point to the user's own NGN/etc. liability ledger
-- account. This prevents a future code path from linking a wallet to a system
-- clearing account or to another customer's account.
CREATE OR REPLACE FUNCTION twipay_assert_wallet_ledger_binding() RETURNS trigger AS $$
DECLARE
  account_owner UUID;
  account_currency CHAR(3);
  account_category "LedgerAccountCategory";
  account_normal "LedgerNormalBalance";
  account_system BOOLEAN;
BEGIN
  SELECT "ownerUserId", "currency", "category", "normalBalance", "system"
  INTO account_owner, account_currency, account_category, account_normal, account_system
  FROM "ledger_accounts" WHERE "id" = NEW."ledgerAccountId";

  IF account_owner IS DISTINCT FROM NEW."userId"
     OR account_currency <> NEW."currency"
     OR account_category <> 'LIABILITY'
     OR account_normal <> 'CREDIT'
     OR account_system
  THEN
    RAISE EXCEPTION 'Wallet ledger account must be the owning user liability account in the same currency';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "wallet_ledger_binding_guard"
  BEFORE INSERT OR UPDATE OF "userId", "currency", "ledgerAccountId" ON "wallets"
  FOR EACH ROW EXECUTE FUNCTION twipay_assert_wallet_ledger_binding();

-- Provider-operation identity is immutable. Provider references may be learned
-- asynchronously, but once assigned they cannot silently change to a different
-- upstream transaction/account identifier.
CREATE OR REPLACE FUNCTION twipay_guard_provider_operation_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'TwiPay provider operations cannot be deleted';
  END IF;
  IF NEW."financialTransactionId" IS DISTINCT FROM OLD."financialTransactionId"
     OR NEW."userId" IS DISTINCT FROM OLD."userId"
     OR NEW."type" <> OLD."type"
     OR NEW."providerCode" <> OLD."providerCode"
     OR NEW."merchantReference" <> OLD."merchantReference"
     OR NEW."requestHash" IS DISTINCT FROM OLD."requestHash"
     OR NEW."correlationKey" IS DISTINCT FROM OLD."correlationKey"
     OR NEW."createdAt" <> OLD."createdAt"
  THEN
    RAISE EXCEPTION 'TwiPay provider operation identity fields are immutable';
  END IF;
  IF OLD."providerReference" IS NOT NULL
     AND NEW."providerReference" IS DISTINCT FROM OLD."providerReference"
  THEN
    RAISE EXCEPTION 'TwiPay provider reference cannot be replaced once assigned';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "provider_operations_mutation_guard"
  BEFORE UPDATE OR DELETE ON "provider_operations"
  FOR EACH ROW EXECUTE FUNCTION twipay_guard_provider_operation_mutation();

-- Transfer destination and narration are an immutable payment instruction.
-- Only the transfer lifecycle status may evolve after creation.
CREATE OR REPLACE FUNCTION twipay_guard_bank_transfer_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'TwiPay bank transfers cannot be deleted';
  END IF;
  IF NEW."financialTransactionId" <> OLD."financialTransactionId"
     OR NEW."beneficiaryId" <> OLD."beneficiaryId"
     OR NEW."narration" <> OLD."narration"
     OR NEW."createdAt" <> OLD."createdAt"
  THEN
    RAISE EXCEPTION 'TwiPay transfer instruction fields are immutable';
  END IF;

  IF NEW."status" = OLD."status" THEN
    RETURN NEW;
  END IF;
  IF (OLD."status" = 'CREATED' AND NEW."status" IN ('VALIDATED','PROCESSING','UNKNOWN','FAILED'))
     OR (OLD."status" = 'VALIDATED' AND NEW."status" IN ('PROCESSING','UNKNOWN','SUCCEEDED','FAILED','REVERSED'))
     OR (OLD."status" = 'PROCESSING' AND NEW."status" IN ('UNKNOWN','SUCCEEDED','FAILED','REVERSED'))
     OR (OLD."status" = 'UNKNOWN' AND NEW."status" IN ('PROCESSING','SUCCEEDED','FAILED','REVERSED'))
     OR (OLD."status" = 'SUCCEEDED' AND NEW."status" = 'REVERSED')
  THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Invalid TwiPay bank transfer transition % -> %', OLD."status", NEW."status";
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "bank_transfers_mutation_guard"
  BEFORE UPDATE OR DELETE ON "bank_transfers"
  FOR EACH ROW EXECUTE FUNCTION twipay_guard_bank_transfer_mutation();
