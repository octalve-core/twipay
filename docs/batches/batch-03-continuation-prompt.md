# Batch 3 continuation prompt

Continue TwiPay from the **exact Batch 2 handoff HEAD supplied in the Batch 2 completion report** (the handoff repository also tags this commit as `batch-02-handoff`). Verify that its history contains Batch 2 implementation commit `0f4703c691cf4498b67b30c15120293e9973223a` and read `BATCH_02_VERIFICATION.md`, `docs/batches/batch-02.md`, the ADRs, architecture, security, integration and runbook documentation before changing code.

Execute **Batch 3 — Services & Events** exactly according to the approved TwiPay architecture, security model, ADRs and Batch 1/2 documentation.

Implement the provider-routing foundation; VTpass + Monnify Bills adapters; normalized product catalogue/pricing; airtime, data, electricity and cable purchase state machines; retries/circuit-breaker/failover foundations; service reconciliation; notification abstraction and Termii/Resend boundaries; and the V1 event domain including organizers, events, ticket types/capacity, checkout, ledger-aware payments/settlement, cryptographically protected QR tickets, check-in state machine, receipts and notification hooks.

Do not weaken the immutable ledger, holds, user-scoped idempotency, `UNKNOWN`/reconciliation rules, server-only secrets, provider boundaries, browser session/CSRF controls or documentation-as-done requirement. Do not invent provider behavior, financial limits or compliance thresholds. Build, test, review, fix, document and commit the batch. If an integration cannot be verified because credentials/network are unavailable, implement against official documented contracts/mocks and report it as blocked rather than guessing.
