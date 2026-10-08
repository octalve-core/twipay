# ADR 015 — Release qualification and fail-closed high-risk features

**Status:** Accepted for Batch 5

A code-complete workflow is not production-qualified merely because static tests pass. TwiPay release classification separates source-level verification from environment-backed qualification. Every mandatory gate is recorded as `PASS`, `FAIL`, `BLOCKED` or `NOT APPLICABLE`; a blocked gate cannot be reported as passed.

Production tags require all mandatory release/staging gates. Otherwise the exact clean repository may be tagged only as a release candidate. `events.refunds` and `operations.organizer_payouts` remain false until MFA, RBAC/maker-checker, accounting/concurrency, provider sandbox, browser/security and staging gates all pass with evidence.

A second server-side latch, `HIGH_RISK_FEATURES_RELEASE_QUALIFIED`, defaults to `false`; recent MFA alone cannot activate refund/payout flags before release qualification has been explicitly completed.
