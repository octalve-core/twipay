-- ISS-017: recover webhook events whose processing died part-way.
-- Additive and nullable; no financial table, ledger entry, wallet or balance is touched, and older code ignores both columns.
--   processingStartedAt: when the current claim began, so a claim whose process died can be told from one still running.
--   recoveryPayloadCiphertext: AES-GCM envelope (DATA_ENCRYPTION_KEY) of the virtual-account fields of a verified delivery, which
--     carry an account number and customer email and so are never stored in the clear. Cleared once the event is PROCESSED.
ALTER TABLE "webhook_events" ADD COLUMN "processingStartedAt" TIMESTAMPTZ(6);
ALTER TABLE "webhook_events" ADD COLUMN "recoveryPayloadCiphertext" TEXT;
