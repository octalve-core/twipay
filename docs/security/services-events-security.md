# Services & Events Security — Batch 3

## Preserved controls

Batch 3 does not weaken Batch 1/2 controls: HttpOnly opaque browser sessions, CSRF protection, exact-origin checks, server-only provider secrets, strict validation, immutable ledger journals, wallet row locking, user-scoped idempotency, encrypted sensitive fields and `UNKNOWN` reconciliation semantics remain mandatory.

## Service-purchase controls

- customer/service identifiers are encrypted at rest and separately HMAC-fingerprinted for deduplication;
- provider validation references are encrypted;
- provider fulfilment/token values are encrypted;
- provider request references are generated and persisted before submission;
- post-submission provider switching is forbidden;
- successful/reversed monetary evidence must match TwiPay amount and currency;
- provider-request-reference mismatch opens a reconciliation case instead of being trusted;
- retries/reconciliation are bounded and exponentially backed off;
- database triggers bind bill purchase, product/offer and financial instruction.

## Event controls

- event checkout uses serializable transactions and advisory locks to prevent overselling;
- financial order values are immutable after creation;
- order lines may only be inserted while the parent order is `CREATED`, must belong to the same event and snapshot the authoritative price;
- ticket issuance requires a paid order and cannot exceed the quantity purchased;
- ticket credentials are high-entropy opaque values authenticated with versioned HMAC keys;
- QR material is encrypted at rest;
- check-in is one-time, row-locked and immutable;
- event refund transitions remain blocked until compensating accounting is implemented.

## Notifications

Notification destination and body are AES-256-GCM encrypted at rest. Destination lookup/deduplication uses a keyed fingerprint. Provider credentials stay in server-side environment/secret stores. Delivery retries are bounded.
