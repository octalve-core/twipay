# TwiPay Phase 6.2 — targeted pre-download remediation and release boundary

**Source authority:** latest Git-backed master in `/Coov Technologies/TWIPAY_PROVISIONAL_MASTER_CODE.zip`, initial HEAD `082e4da69145a778919024d62ded9335af81cbbe`.

**Non-negotiable:** This checkpoint is source remediation, not a live financial service launch or production security certification. No Node 24 installation, PostgreSQL migration, pnpm frozen install or provider operation can be claimed unless independently executed.

## Audit issue → remediation

1. **P0 — Reproducible builds:** Existing exact Node `24.21.0` and pnpm `12.9.1` pins, `--prepare-lock` workflow, and frozen CI are retained. A genuine `pnpm-lock.yaml` must be created from real dependency resolution on a trusted connected machine; do not invent the lockfile, trust a stale developer export, or claim builds passed using Node 22. The workflow checks the lock and runs `pnpm build`, typecheck and tests before any release consideration. GitHub workflows are *not executed* merely by existing in source.
2. **P0 — Tier authorization:** Migration `0018_financial_tier_independent_approval` adds evidence-backed prepared/approved/rejected decisions. `FinancialTierReviewService` and `/v1/operations/financial-eligibility` require separate maker/checker roles, current staff MFA and transaction-bound session reauthorization, active customer/contact/BVN evidence, enrolled customer MFA, independent configurable upper caps, row locks, serializable transactions and audited evidence. The verified BVN evidence must be the actual `identity_verifications.id`, owner-bound, verified and unexpired. The database forbids two pending cases, self-approval and prepared-evidence edits; a trigger prevents changing financial eligibility to approved without a matching independent reviewed decision. No previous accounts are backfilled or auto-approved. The `financial_eligibility_policies` approval trigger requires that the approved tier, exact limits and approval timestamp match an independently checked review. The review workflow is sandbox-only and **default-off**; production rollout still needs independent compliance and runtime signoff.
3. **P0 — Production hard stops:** These remain intentional. No permanent “enable all” switch is introduced. A separate production approval design must require (a) licensed partner/custody model review, (b) approved fee/limit policy by product, (c) authenticated provider webhooks and reconciliation, (d) independent penetration review, (e) database/browser test evidence, (f) dual authorization for release toggles, (g) staged canary, emergency kill switch and rollback. No financial, event ticket or admission action is enabled by this checkpoint.
4. **P1 — Stale browser contracts:** Account profile, callback, bills and funding specs are aligned with the active ErhaPay sources. Where a test would require provider credentials or PIN-backed money movement, it is explicitly skipped rather than faking success. These tests still must be executed in a browser against running Node 24 / PG18 / Redis 8 services; a Playwright `--list` compilation gate is added to CI.
5. **P1 — CI and visual parity:** CI and browser E2E respond to the active `phase3/**` branch and future `phase4/**`, `phase5/**`, `phase6/**` branches. The original ErhaPay design is retained, but visual parity needs two *actually running* independent React/Vite apps, using `scripts/design/capture-erhapay-public-reference.mjs`, and human review of screenshots at its documented eight viewports. No visual acceptance is automatically inferred from asset parity.
6. **P1 — Permanently excluded betting:** Unused ErhaPay betting sources moved to `docs/archive/erhapay-excluded-betting-source`; removed active component imports, API calls, store, form schema and menus. The original blocked direct route is retained to deny deep links. A source scanner passes now, and `pnpm test:betting-bundle` is wired into CI **after** a real Vite build to reject banned executable code. No claim that bundle exclusion is verified until the actual bundle is built and scanned.

## Before signing off on any production enablement

A separate, independently reviewed release manifest must bind the exact Git SHA, true `pnpm-lock.yaml` SHA-256, Node/pnpm versions, migration IDs (0001–0018), PG18/Redis8 runtime test logs, anonymized auth/financial/e2e traces, provider contract outcomes, GDPR/NDPA risk handling, financial-partner authorization, reviewer identities and timestamped evidence. Production hard-stops must only be changed in a new reviewed release with multi-person authorization and rollback rehearsal; **do not blind-fix a block by deleting it**.

## Known remaining execution blocks

This current container has Node 22.16.0, no pnpm, no PostgreSQL 18/Redis8, and npm registry DNS fails. `pnpm-lock.yaml` cannot be authentically generated here. Source and mocked tests can pass, but semantic typecheck/build, Prisma 0018 migration, concurrent approvals, full browser visual parity, forbidden production bundle scan and actual providers remain **UNVERIFIED**.

## Verified local checkpoint (the exact final Git SHA is in the authoritative Library handoff)

- `npm run test:repo`: **PASS**, TypeScript syntax, repository security, architecture, financial invariants, services/events, product/operations, production-hardening and original ErhaPay visual inventory; see `docs/phase6/evidence/phase62-source-scanners-2026-10-09.txt`.
- Node 22.16.0 supported dependency-light tests: **449/449 passed**, zero failures/skips; see `docs/phase6/evidence/phase62-offline-regression-2026-10-09.txt`. This adds ten targeted Phase 6.2 behavioral tests for maker/checker review (including KYC evidence ownership and expiry).
- `node scripts/qualification/betting-exclusion-check.mjs`: PASS active-source exclusion; **`--built` intentionally fails because no real Vite production bundle exists**. A source-only pass cannot establish production bundle exclusion.
- GitHub CI source YAML parsed; workflow execution not claimed.
- **Not executed**: Node 24 semantic typechecks or builds, Prisma generation/migration 0018, real PostgreSQL session locks, Redis worker, actual React browser/Playwright, original ErhaPay visual parity, sandbox providers, external security penetration testing.
- **Explicit incomplete P0/P1 signoff**: A real dependency lockfile, independent financial approval concurrency under PG18, complete financial production-enablement certification, historical/full compiled bundle exclusion, and browser screenshot evidence remain required. There is no shortcut allowing a production go-live.

## Authentic lockfile recovery commands (on trusted connected Node 24 runner only)

```bash
node --version                       # must be 24.21.0 as pinned
corepack enable
corepack pnpm --version              # must match packageManager (12.9.1)
bash scripts/qualification/phase1-3-run-local.sh --prepare-lock
# Inspect dependency graph / peer warnings / scripts and commit the generated lockfile.
pnpm install --frozen-lockfile
pnpm db:generate
pnpm --filter @twipay/database prisma:validate
pnpm --filter @twipay/database prisma:deploy  # disposable PG18 only
pnpm test:repo && pnpm test:offline-regression
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm test:betting-bundle
pnpm exec playwright test --config playwright.customer-ui.config.ts --list
```

Run actual browser suites with disposable customer/MFA fixtures and independent original ErhaPay reference screenshots. All provider payouts and admissions remain off until separate authorized sandbox qualification and risk signoff.
