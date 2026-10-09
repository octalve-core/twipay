-- Phase 4.2: retain original transfers and history; existing records are not auto-saved.
ALTER TABLE "beneficiaries" ADD COLUMN "saved" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "nickname" VARCHAR(60), ADD COLUMN "archivedAt" TIMESTAMPTZ(6);
ALTER TABLE "bank_transfers" ADD COLUMN "approvalQuoteId" UUID,
  ADD COLUMN "accountNameSnapshot" VARCHAR(180),
  ADD COLUMN "bankCodeSnapshot" VARCHAR(40),
  ADD COLUMN "accountLast4Snapshot" VARCHAR(4);
CREATE UNIQUE INDEX "bank_transfers_approvalQuoteId_key" ON "bank_transfers"("approvalQuoteId");
