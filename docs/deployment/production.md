# Production deployment

Deploy immutable artifacts from a reviewed release commit/tag. Required runtime: Node 24 LTS, PostgreSQL 18, Redis, independent web/admin/API/worker services, Cloudflare edge controls, managed secrets, structured logs and error monitoring.

## Order

1. Confirm release matrix has no mandatory `FAIL`/`BLOCKED` for a production tag.
2. Confirm repository/tag/commit signatures and exact image digests/SBOM/security reports.
3. Take/verify pre-change managed backup/PITR state.
4. Run `prisma migrate deploy` once against the target database; never run development migrations in production.
5. Deploy API/worker compatible with the migration, then web/admin.
6. Run health, auth/session/MFA, read-only finance and provider connectivity smoke checks.
7. Observe errors/latency/queue lag/reconciliation before increasing traffic.
8. Keep high-risk flags off unless their separate activation evidence is complete.

Financial database migrations are forward-fix by default. Never roll a database schema backward if doing so can discard or reinterpret ledger/provider history.

`HIGH_RISK_FEATURES_RELEASE_QUALIFIED=true` is a post-qualification production configuration, not a deployment default. Set it only after all mandatory release gates pass, then separately activate any high-risk feature through the audited RBAC + recent-MFA flag workflow.
