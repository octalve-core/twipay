# Batch 2.2 — Actual source verification and remaining UI qualification

Date: 2026-10-09. Base: Phase 2.1 Git `cbb698d0d1e5799f37be40f386e9994d8815b9a1`.

## Implemented

- Minimal ErhaPay visual-component changes and documented change decisions: `docs/design/BATCH_2_2_CONTROL_REFINEMENT_2026-10-09.md`.
- No original image/icon assets modified; no backend, database, worker, ledger or financial feature flags changed.
- No new customer routes or unrelated visual design changes.
- Design-inventory regenerated and explicitly checked after source changes, including 123 original image/icon hashes.
- Eleven source-control contract tests added; CI and `test:design` include them alongside eight prior design tests.
- Three read-only Playwright UI specs added but not executed; original/current screenshot reference capture script prepared and fail-closed for missing localhost URLs.
- Corrected dishonest UI indicators: unverified account badges, nonexistent remember-device checkbox and dead password-reset navigation (actual account verification/recovery remains Phase 3).

## Checks actually executed

- `node scripts/design/erhapay-ui-inventory.mjs --check`: PASS; 59 declared router paths; original 123 images/icons preserved, 69 bytes identical and 54 SVG line-ending-only differences.
- `node --test docs/design/test/*.test.mjs`: **19/19 PASS** (8 Batch 2.1 + 11 Batch 2.2).
- `node --experimental-strip-types --test docs/migration/test/*.test.mjs docs/qualification/batch-f-ticket-security.test.mjs`: **104/104 PASS**.
- `node --experimental-strip-types --test docs/integration/test/*.test.mjs scripts/test/stack-readiness.test.mjs`: **43/43 PASS**.
- `node scripts/typescript-syntax-check.mjs`: PASS (449 source files). Syntax only; not a dependency-backed TS build.
- Source-only repository security, architecture, financial, services, product and hardening invariant scanners: PASS.
- Reachable Git-history secret scan: PASS.
- Phase 1.3 qualification preflight: 5 PASS, 0 FAIL, 9 BLOCKED.
- Phase 1.4–1.6 qualification: 11 PASS, 0 FAIL, 8 BLOCKED.
- Local-only screenshot capture with missing reference URL: intentionally **BLOCKED** before browser launch as designed.

## Not executed and not qualified

- No Node 24 dependency-backed application build, actual React execution test or screenshot-difference inspection.
- No original ErhaPay reference build, Playwright screenshot capture, screen-reader keyboard audit across browser engines, or authenticated dashboard browser journey.
- No live provider payments, real database, Redis or admin authorization testing.
- No Google OIDC sign-in, secure server transaction PIN or password reset backend; these belong to Phase 3/4.

The old `CustomButton` default submit type and Radix base primitives have deliberately not been globally refactored because existing form behaviour would need runtime verification. Every introduced UI-only improvement remains subject to responsive visual acceptance. This is a source checkpoint only.
