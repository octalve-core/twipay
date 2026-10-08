# Staging qualification

Staging uses no real customer money, production identity data, or live-provider credentials. It must be close enough to production to exercise PostgreSQL 18, Redis/BullMQ, TLS/Cloudflare behavior, the four runtime applications and provider **sandbox/test** integrations.

A production promotion requires evidence for: empty-database and supported-upgrade migrations; dependency-backed lint/typecheck/tests/build; PostgreSQL invariants/concurrency; Redis worker restart/retry/idempotency; browser E2E; sandbox provider success/failure/timeout/requery; DAST; load/failure tests; encrypted backup plus clean restore; and deployment rollback. Record each result in the release matrix. A blocked item is not a pass.

`events.refunds` and `operations.organizer_payouts` stay disabled until all activation gates pass. Staging may exercise these workflows only through a controlled, temporary test configuration with no real money and must return them to false before the release artifact is classified.

The API release latch `HIGH_RISK_FEATURES_RELEASE_QUALIFIED` remains `false` for an RC. It may be set `true` only after the complete signed production qualification matrix passes; the database flags still require a separate authorized, recent-MFA activation.
