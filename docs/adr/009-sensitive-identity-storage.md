# ADR 009 — Encrypt identity identifiers and fingerprint separately

**Status:** Accepted

## Context
BVN/NIN are highly sensitive identifiers but TwiPay needs to prevent repeated verification and sometimes provide the value to a regulated integration after user consent.

## Decision
Store AES-256-GCM ciphertext plus a versioned envelope, a separate HMAC-SHA256 fingerprint for deterministic deduplication and only a last-four display value. Encryption and fingerprint keys are distinct server-only secrets.

## Consequences
Search uses the fingerprint; plaintext exists only transiently at validated provider boundaries. Key rotation needs a controlled re-encryption process rather than schema changes.
