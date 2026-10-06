# Batch 4 continuation contract

Continue TwiPay from the Batch 3 handoff tag/HEAD recorded by the final Batch 3 handoff commit. Read first:

- root `BATCH_03_VERIFICATION.md`;
- `docs/batches/batch-03.md`;
- `docs/architecture/services-events.md`;
- `docs/security/services-events-security.md`;
- all Batch 1/2 architecture/security/financial ADRs and verification records.

## Exact continuation prompt

> Continue TwiPay from the exact Batch 3 handoff tagged `batch-03-handoff` (resolve and verify it locally with `git rev-parse batch-03-handoff` before making changes). Execute Batch 4 — Product Experience & Operations exactly according to the approved TwiPay architecture, security model, ADRs, Batch 1–3 documentation and `BATCH_03_VERIFICATION.md`. Complete the TwiPay customer web experience and Octalve-minimal visual migration; build the admin/operations/compliance experience; implement refunds/disputes only through atomic compensating-ledger workflows; implement organizer settlement/payout operations with maker/checker controls where money leaves TwiPay; add provider-health/routing operational controls and verified cross-provider SKU mapping without guessing equivalence; add commissions/reports, feature flags, configurable product branding/white-label/licensing foundations and operational documentation. Preserve provider abstraction, immutable/sealed ledger journals, integer minor units, user-scoped idempotency, holds/concurrency controls, UNKNOWN/reconciliation rules, exact provider evidence checks, server-only secrets, session/CSRF/exact-origin controls, encrypted sensitive data, ticket credential security, auditability and documentation-as-done. Do not copy legacy ErhaPay/Data Arena architecture, do not silently enable refunds or organizer payouts without matching accounting/authorization/audit controls, and do not claim environment-blocked verification as passed. Build, test, review, fix, document and commit Batch 4 with an exact handoff report and Batch 5 continuation prompt.

The immutable `batch-03-handoff` Git tag is the repository source of truth for the exact Batch 3 handoff commit. The external handoff report also records its full SHA-1.

## Batch 4 expected outcomes

- TwiPay customer web flows for identity/profile, wallet/transactions, utilities, events/orders/tickets and receipts using the real TwiPay API contract;
- TwiPay admin/ops/compliance interface with RBAC-aware actions;
- audited refund/dispute workflows with compensating journals rather than historical ledger mutation;
- organizer settlement/payout workflow with strong authorization, idempotency, reconciliation and maker/checker for sensitive money movement;
- provider health and routing administration;
- explicit verified mapping between equivalent provider bill offers; never infer equivalence from marketing labels alone;
- configurable commissions/pricing/reporting foundations;
- feature flags;
- brand/product configuration separated from platform core for future white-label/licensing;
- removal of remaining inherited/mock ErhaPay UI assumptions;
- updated OpenAPI/docs/ADRs/runbooks/tests;
- clear executed-vs-blocked verification record.
