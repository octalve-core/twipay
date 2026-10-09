-- Phase 4.5: add unique, immutable quote consumption without replacing legacy financial transitions.
ALTER TABLE "bill_purchases" ADD COLUMN "approvalQuoteId" UUID;
CREATE UNIQUE INDEX "bill_purchases_approvalQuoteId_key" ON "bill_purchases"("approvalQuoteId");
CREATE OR REPLACE FUNCTION twipay_guard_bill_purchase_update() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'bill purchases cannot be deleted'; END IF;
  IF NEW."approvalQuoteId" IS DISTINCT FROM OLD."approvalQuoteId" THEN
    RAISE EXCEPTION 'bill purchase approval quote is immutable';
  END IF;
  IF NEW."userId" <> OLD."userId" OR NEW."financialTransactionId" <> OLD."financialTransactionId"
     OR NEW."productId" <> OLD."productId" OR NEW."providerOfferId" <> OLD."providerOfferId"
     OR NEW."customerIdentifierCiphertext" <> OLD."customerIdentifierCiphertext"
     OR NEW."customerIdentifierFingerprint" <> OLD."customerIdentifierFingerprint"
     OR NEW."amountMinor" <> OLD."amountMinor" OR NEW."currency" <> OLD."currency"
     OR NEW."providerRequestReference" <> OLD."providerRequestReference" THEN
    RAISE EXCEPTION 'bill purchase instruction is immutable';
  END IF;
  IF NEW."status" <> OLD."status" AND NOT (
    (OLD."status"='CREATED' AND NEW."status" IN ('VALIDATING','VALIDATED','FAILED','CANCELLED')) OR
    (OLD."status"='VALIDATING' AND NEW."status" IN ('VALIDATED','FAILED','CANCELLED')) OR
    (OLD."status"='VALIDATED' AND NEW."status" IN ('FUNDS_RESERVED','FAILED','CANCELLED')) OR
    (OLD."status"='FUNDS_RESERVED' AND NEW."status" IN ('PROVIDER_SUBMITTED','FAILED','CANCELLED')) OR
    (OLD."status"='PROVIDER_SUBMITTED' AND NEW."status" IN ('PROCESSING','UNKNOWN','SUCCEEDED','FAILED','REVERSED')) OR
    (OLD."status"='PROCESSING' AND NEW."status" IN ('UNKNOWN','SUCCEEDED','FAILED','REVERSED')) OR
    (OLD."status"='UNKNOWN' AND NEW."status" IN ('PROCESSING','SUCCEEDED','FAILED','REVERSED')) OR
    (OLD."status"='SUCCEEDED' AND NEW."status"='REVERSED')
  ) THEN RAISE EXCEPTION 'invalid bill purchase state transition'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
