# TwiPay — PC-to-staging qualification order

This is a release **candidate**, not approval to accept real funds. Node 24 LTS, pnpm, Docker, PostgreSQL 18, Redis, provider sandbox credentials and managed secrets are prerequisites depending on the check. Never copy production credentials into local files included in Git.

1. Open the Git repository on the PC and confirm `git status --short`, `git rev-parse HEAD`, `git tag --points-at HEAD`.
2. Install supported Node 24 and the packageManager pnpm version from `package.json`; run `node -v`, `pnpm -v`. Use the actual pnpm version published by the registry; if manifest version is unavailable, treat as a manifest defect and correct with evidence, not an invented lockfile.
3. Run `pnpm install` online and commit its *real* `pnpm-lock.yaml`; thereafter run CI using `pnpm install --frozen-lockfile`.
4. Run `pnpm db:generate`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`; inspect/fix any failures.
5. Use isolated **development** PostgreSQL 18 and Redis. Set the service-specific secret environment variables privately, using `.env.example` and `docs/deployment/environment-variables.md` as references. Do not set every server secret on Vercel.
6. Run migrations from an empty DB, verify constraints and separately rehearse the approved upgrade migration path. Run real financial, session and MFA concurrency tests.
7. Run the customer/admin (Vercel-compatible Next.js), API and worker as four actual services. Vercel is a reasonable target for the two frontends, while a persistent container host is needed for NestJS and BullMQ worker. Confirm exact-origin/CORS, cookies and the server-only API boundaries.
8. Run the real Playwright browser E2E and abuse scenarios against the isolated running stack. Do not substitute static route assertions.
9. Connect **sandbox** provider keys only, run success/timeout/duplicate/late webhook tests and prove UNKNOWN -> same-provider reconciliation. Verify all ledger postings/holds.
10. Deploy isolated staging; configure Cloudflare, hosting, secrets, monitoring, backup, restore, DAST, load tests and rollback. Record actual evidence in the qualification matrix.
11. Review CodeQL/SAST, lockfile/dependency audit, SBOM, Docker/container vulnerability scans, Git-secret checks and CI.
12. Keep refund and organizer payout flags OFF throughout normal staging. Only use tightly controlled, explicitly approved test environments without real money to test enabled paths; turn them OFF afterward. Production activation is a distinct approval after full qualification.

The rollback policy is forward-fix for financial schema; never destroy posted journals, audit history or provider submission references to roll back an app version.
