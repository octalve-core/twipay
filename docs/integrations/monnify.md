# Monnify payment adapter

**Batch activated:** 2
**Boundary:** `packages/providers/payments/monnify`

## Capabilities
- API-key/secret access-token authentication.
- Initialize/verify collections.
- Reserved accounts.
- Nigerian account name enquiry.
- Asynchronous single payouts.
- Payout verification.
- Raw-body webhook HMAC verification.
- Normalization of Reserved Account successful-deposit events.

## Security/operational rules
- Credentials remain server-only.
- Production webhook requires `monnify-signature`: HMAC-SHA512 over raw payload using the client secret.
- Unsigned webhooks are accepted only when explicitly enabled **and** adapter host is the Monnify sandbox; production host never accepts unsigned events.
- Current live disbursement requirements include server IP whitelisting; the final deployment egress IP must be configured before enabling live payouts.
- TwiPay performs beneficiary name enquiry before submitting payouts.
- Webhook evidence is not settlement authority; TwiPay re-queries Monnify before ledger changes.

## Reserved-account deposits
Current Monnify successful reserved-account events identify the product as `RESERVED_ACCOUNT`, include the reserved `product.reference`, destination account and payment/transaction references. TwiPay normalizes these fields, maps the account, then calls the transaction query endpoint. Only `PAID`/normalized success with exact amount and currency can credit the ledger.

## Amounts
TwiPay owns money as integer minor units. Monnify's decimal major-unit values are normalized to minor-unit `bigint` inside the adapter and never become the ledger representation directly.

## Configuration
- `MONNIFY_API_KEY`
- `MONNIFY_SECRET_KEY`
- `MONNIFY_CONTRACT_CODE`
- `MONNIFY_SOURCE_ACCOUNT_NUMBER` for payouts
- `MONNIFY_BASE_URL` (sandbox by default outside production)

## Provider docs verified during Batch 2
- Webhooks: `https://developers.monnify.com/docs/webhooks/`
- Webhook event types: `https://developers.monnify.com/docs/webhooks/event-types`
- Reserved Accounts: `https://developers.monnify.com/docs/collections/recurring-payments/reserved-accounts`
- Transaction verification / developer docs: `https://developers.monnify.com/`

Revalidate IP-whitelisting, authorization and transfer requirements immediately before live activation.
