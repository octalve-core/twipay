# TwiPay Phase 2.1 — Source Design Inventory Verification

Date: 2026-10-09. Starting commit: `5434bc93e8964f1c65a14e074592b3d709b4c33b`.

## Work delivered

- Deterministic design inventory generator in `scripts/design/erhapay-ui-inventory.mjs` with `--write` and `--check`; 318 TS/CSS source files inspected at this checkpoint.
- Source-derived design contract at `docs/design/ERHAPAY_DESIGN_INVENTORY.md` and machine-readable component/route inventory at `docs/design/ERHAPAY_COMPONENT_INVENTORY.json`.
- Frozen original ErhaPay **image/icon** hash baseline from `erhapay-source(2).zip` at `docs/design/ERHAPAY_ORIGINAL_VISUAL_ASSETS.json`.
- Additive `ErhaPageFrame`, `ErhaPageHeading`, `ErhaSettingsPanel` future-page composition primitives that copy existing settings styles; existing customer UI routes and styles were not modified by this batch.
- Eight new source-only design tests, exposed through the root `test:design` and `design:inventory` package scripts and a source-only CI check.
- Fix to historical Batch A + Phase 1.4 tests: a clean Git checkout with `.gitattributes` LF normalization previously failed its original SVG CRLF *byte* hash assertion. Both assertions now require exact SHA-256 for all non-SVG assets, and accept the original SHA or the **specifically frozen normalized SHA** for original SVGs. Any content change still fails. The original preserved Phase 1.4 baseline remains unmodified.

## Source-derived metrics

- React Router: 59 literal route paths (includes inactive/deferred and protected routes).
- Layouts: four (marketing, auth, dashboard, receipt).
- Generic UI primitives: 15; dashboard domain subdirectories: 15.
- Original images/icons: 123. 69 byte-exact, 54 SVGs line-ending-normalized, zero material differences; fonts not included in that metric.
- Source-level palette and breakpoint reference counts are **occurrences**, not runtime effective style tokens, and are recorded in the inventory JSON.

## Actual commands executed

- `node scripts/design/erhapay-ui-inventory.mjs --check` — PASS.
- `node --test docs/design/test/batch-21-design.test.mjs` — **8/8 PASS**.
- `node --experimental-strip-types --test docs/migration/test/*.test.mjs docs/qualification/batch-f-ticket-security.test.mjs` — **104/104 PASS**.
- `node --experimental-strip-types --test docs/integration/test/*.test.mjs scripts/test/stack-readiness.test.mjs` — **43/43 PASS**.
- `node scripts/qualification/phase1-4-6-gates.mjs` — 11 source gates PASS, 0 FAIL, eight runtime gates BLOCKED.
- `node scripts/qualification/phase1-3-preflight.mjs` — five source gates PASS, 0 FAIL, nine runtime gates BLOCKED.
- TypeScript *syntax*, repository security, architecture, finance, services/events, product operations, production hardening and reachable Git history secrets scanners — PASS.

## Not executed / not approved

- No actual customer React/Vite build or rendered screenshots (Node 24/pnpm dependency graph unavailable).
- No responsive/browser/a11y visual comparison, so pixel equivalence to original ErhaPay is NOT asserted.
- No provider payments, no PostgreSQL/Redis tests, no admin authorization E2E; Phase 1 release qualification remains open.
- No Google OIDC sign-in or server-enforced transaction PIN implemented; requirements remain in Phase 3/4.
- No deferred routes activated and no live financial/ticketing flags enabled.

## Next development order

**Batch 2.2:** Review and standardize user-visible controls incrementally against real snapshots, address verified accessibility issues and duplicate button semantics without global CSS replacements. **Batch 2.3:** consolidate active route/layout navigation, preserve inactive modules, and validate deployment customer shell. **Batch 2.4–2.6:** controlled brand changes, new-page scaffolding, and responsive screenshot/a11y approval. When the developer provides real Phase 1.3–1.6 execution logs, qualify those independently before production approval.
