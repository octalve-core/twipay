# Mono identity verification adapter

**Batch activated:** 2  
**Boundary:** `packages/providers/identity/mono`

## Capabilities
- BVN consent-flow initiation.
- BVN verification-method / OTP continuation and details retrieval.
- NIN lookup.

## Security/cost controls
- `MONO_SECRET_KEY` is server-only.
- BVN/NIN must pass TwiPay's 11-digit local validation before any provider request.
- Explicit customer consent is recorded before provider invocation.
- Per-user attempt throttling occurs before billable calls.
- Provider session/reference IDs are stored; OTP values and raw identity attributes are not persisted by TwiPay's KYC service.
- BVN/NIN is stored as AES-256-GCM ciphertext with a separate HMAC fingerprint and last-four display value.
- Already verified checks short-circuit locally; failed/expired checks cannot be blindly continued.
- OTP request/submission actions are state constrained.
- A provider/network exception becomes pending/unknown evidence instead of definitive failure, avoiding blind repeated billable checks.

## V1 eligibility policy
TwiPay accepts NIN verification for identity purposes, but **wallet-funding virtual accounts require verified BVN in V1**. This is a TwiPay risk policy, not a claim that every external provider requires only BVN.

## Configuration
- `MONO_SECRET_KEY`
- `MONO_BASE_URL` (default `https://api.withmono.com`)

## Provider docs verified during Batch 2
- BVN initiation/verification/details: `https://docs.mono.co/api/bvn/initiate`
- Mono identity/KYC docs: `https://docs.mono.co/`

Revalidate pricing, consent requirements and endpoint behavior before live activation.
