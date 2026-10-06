# Monnify Bills Adapter

Verified against Monnify Bills documentation and the maintained official Monnify Laravel integration during Batch 3 (2026-10-06).

## Enablement

Bills payment is not assumed to be enabled for every Monnify merchant. Octalve must request/confirm merchant enablement before production activation.

## Workflow

TwiPay follows the provider flow: category/biller/product discovery -> mandatory customer validation where required -> vend -> requery.

Current adapter paths:

- `GET /api/v1/vas/bills-payment/billers?category_code=...`
- `GET /api/v1/vas/bills-payment/biller-products?biller_code=...`
- `POST /api/v1/vas/bills-payment/validate-customer`
- `POST /api/v1/vas/bills-payment/vend`
- `GET /api/v1/vas/bills-payment/requery?vendReference=...`

`vendReference` is the provider request/query reference persisted before submission. Authentication uses the server-side Monnify access-token flow.
