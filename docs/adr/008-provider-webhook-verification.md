# ADR 008 — Webhooks are signals, provider re-query is financial evidence

**Status:** Accepted

## Context
Webhook endpoints are public and can be replayed or forged if validation fails. Even a correctly signed event may be duplicated.

## Decision
Adapters verify provider signatures over the raw body using constant-time comparison. TwiPay deduplicates verified events and performs a server-to-server transaction query before ledger settlement. A webhook payload alone cannot credit a wallet.

## Consequences
Provider adapters must expose verification/re-query operations. Settlement methods must remain idempotent. Webhook processing can safely move to asynchronous workers without changing financial rules.
