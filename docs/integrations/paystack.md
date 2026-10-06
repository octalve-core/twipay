# Paystack payment adapter

**Batch activated:** 2  
**Boundary:** `packages/providers/payments/paystack`

## Capabilities
- Initialize/verify collections.
- Dedicated Virtual Account assignment.
- Nigerian bank-account name resolution.
- Transfer-recipient creation and payouts.
- Payout verification.
- Raw-body webhook signature verification.
- Normalization of dedicated-account assignment and Dedicated NUBAN credit events.

## Security/settlement rules
- `PAYSTACK_SECRET_KEY` is server-only and authenticates API calls/webhooks.
- Webhooks require `x-paystack-signature`: HMAC-SHA512 over the raw payload.
- Signature comparison is constant-time.
- `charge.success` is considered virtual-account evidence only when authorization channel is `dedicated_nuban` and a receiving account is present.
- A signed charge never credits TwiPay directly: TwiPay calls Paystack's transaction verification endpoint and checks status, exact amount and currency before ledger posting.
- Raw webhook payloads are reduced to normalized references/status evidence before persistence.

## Dedicated Virtual Accounts
Paystack's current Nigerian financial-services assignment path is asynchronous and requires customer identity plus validation-bank details. TwiPay therefore requires verified BVN and, for Paystack assignment, a server-validated bank code/account number before `/dedicated_account/assign` is called.

Assignment may initially return pending. TwiPay recognizes the signed `dedicatedaccount.assign.success` / `.failed` events and completes or reconciles the existing operation. Assigned account numbers are encrypted at rest.

## Transfers
TwiPay first resolves the beneficiary, then Paystack adapter creates a transfer recipient and transfer. Provider configurations that return OTP/authorization-required status are kept non-terminal with funds held. Do not claim automated live payouts on an account requiring interactive authorization until the provider/account configuration or a supported authorization flow is completed.

## Configuration
- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_BASE_URL` (default `https://api.paystack.co`)

## Replacement
Business/domain code imports `PaymentProviderPort`. Only the API provider registry composes Paystack. Routing to another provider must not require ledger/controller rewrites.

## Provider docs verified during Batch 2
- Webhooks: `https://paystack.com/docs/payments/webhooks/`
- Dedicated Virtual Accounts: `https://paystack.com/docs/payments/dedicated-virtual-accounts/`
- Transfers: `https://paystack.com/docs/transfers/`

Revalidate provider contracts immediately before live activation.
