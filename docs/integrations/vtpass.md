# VTpass Bill Adapter

Verified against official VTpass developer documentation during Batch 3 (2026-10-06).

## TwiPay capability

Airtime, data, electricity and cable are exposed only through `BillProviderPort`; no controller/domain service imports VTpass directly.

## Authentication

VTpass GET discovery requests use `api-key` + `public-key`. POST operations use `api-key` + `secret-key`. Credentials are server-only.

## Request ID / reconciliation

VTpass requires a request ID whose leading 12 digits are Lagos/GMT+1 `YYYYMMDDHHmm`. TwiPay allocates and stores this request ID **before** submitting `/api/pay`, then reuses the exact value with `/api/requery`.

This prevents a timeout from stranding an `UNKNOWN` transaction with no query key.

## Status safety

Nested transaction status is preferred. A top-level `000` means the request was processed; without explicit nested success evidence TwiPay remains `UNKNOWN`. Processing (`099`) stays processing. Deterministic failure codes map to failed. Duplicate request code `014` is treated as uncertain and reconciled rather than blindly retried through another provider.

## URLs

- Docs: `https://www.vtpass.com/documentation/`
- Requery: `POST /api/requery`
