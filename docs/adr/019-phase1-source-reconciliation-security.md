# ADR 019 — Three-source reconciliation must preserve financial security

**Status:** Accepted for Phase 1.1–1.2 source integration, not runtime qualification.

## Context

The developer source export has Prisma 7 adapter/toolchain fixes and an incomplete root-only lockfile. The Git-backed Batch F master has later financial, events and customer security changes. ErhaPay is the required UI authority. Copying one source over another is unsafe.

## Decision

- Branch from `7868046893addc4bfa9384b19f474eb3428350ad` and preserve the complete prior Git history.
- Record SHA-256 of each input archive, a source diff and per-path decisions.
- Port developer Prisma 7/runtime fixes, removing the developer's hardcoded DB password fallback. Missing runtime `DATABASE_URL` must fail closed.
- Preserve all newer financial/ticket sandbox gates, ticket credential isolation and audit, recipient verification, ledger, holds, idempotency, provider UNKNOWN reconciliation and UI.
- The exported `pnpm-lock.yaml` has only the root importer; keep it for provenance but require a new genuine full-workspace lockfile before CI/deployment.
- The developer's operational journals may include developer credentials; do not copy them to this Git history until sanitized.
- Google OIDC authorization-code login with PKCE and **mandatory server-side transaction PIN** have been accepted as future Phase 3/4 implementation requirements. Neither is claimed to exist now.

## Consequences

Source-level checks may pass while real Node 24, pnpm, Postgres, Redis, provider sandbox, Playwright and visual regression remain blocked. None of those blockers may be relabeled as PASS. No financial feature may be activated on this evidence alone.
