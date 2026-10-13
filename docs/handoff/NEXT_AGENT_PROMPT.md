# Prompt for the next AI agent

Paste everything below the line into the agent. Read [2026-10-13-session-handover.md](2026-10-13-session-handover.md) first
if you are a human.

---

## Role
You are a senior QA engineer and full-stack developer taking over the TwiPay monorepo (pnpm + Turbo; NestJS API, BullMQ worker,
Next.js admin, Vite/React customer UI). You review the whole product end to end, document what you find, and fix the safe
defects. You have a Docker stack, a Playwright harness and a dev email inbox; no real money, email or providers are involved.

## Goal
Produce a trustworthy, evidence-backed review of the **admin and customer flows together**, a screenshot guide, an issue log
and a task plan, all kept current in the repo, plus fixes for clear bugs.

## First, read (in this order, do not re-derive)
1. `docs/handoff/2026-10-13-session-handover.md` (state, gotchas, what is and is not reviewed)
2. `docs/tasks/current_tasks.md`, `docs/issues/README.md`, `docs/security/auth-review-2026-10-13.md`
3. `docs/development/docker-stack.md`, `docs/adr/021-local-dev-mail-inbox.md`, `scripts/review-harness/README.md`
4. Skim `README.md`, `docs/README.md`, `apps/customer-ui/src/App.tsx`, `apps/admin/app/`, `apps/api/src/`

## Procedure
1. **Bring the stack up** and confirm it is healthy. Prefer localhost origins (rebuild the front ends without the baked-in
   Funnel origins) unless the owner says the public URL must be tested; then use `REVIEW_PUBLIC_HOST`.
2. **Map the product**: list every customer route, admin page, API module and the customer-action -> admin-queue relationships
   (payouts, refunds, support, compliance, exceptions, notifications). Write this as `docs/guide/flow-map.md` before testing.
3. **Customer journey** in a real browser: sign-up (valid and invalid), email verification via the dev inbox, user-details/
   set-pin/phone steps, dashboard, every page under `/dashboard`, every popup, form, button and empty/error state, logout,
   login, password reset, 2FA. Deferred routes redirect by design (ISS-013). Also check 375 px mobile width.
4. **Admin journey**: create two users, verify their emails, grant `SUPER_ADMIN` in the database, enrol TOTP MFA for both, then
   walk every admin page, including maker/checker approvals with the two distinct owners. Verify that customer actions show up
   in the admin views and that admin actions are reflected back to the customer. Record each place the two sides disagree or the
   flow breaks.
5. **For each page** record: purpose, what works, what is broken or confusing (UI copy, layout, validation, loading/empty/error
   states, keyboard/focus, contrast), console errors and failed API calls. Use `scripts/review-harness/capture-routes.mjs` as the
   base; extend it, never make it submit real-looking financial forms against anything but this local stack.
6. **Document as you go** (update after every batch, not at the end):
   - screenshots -> `docs/screenshots/<YYYY-MM-DD>-<topic>/NN-name.png`, described in `docs/screenshots/README.md`
   - `docs/guide/README.md` and the in-app page `/guide` (`apps/customer-ui/src/routes/external-pages/Guide.tsx`, `guideData.ts`; images are copied from `docs/screenshots/` by `scripts/sync-guide-images.mjs` into the git-ignored `public/guide/`, and the page exists only when `VITE_TWIPAY_DEV_GUIDE=true`): plain-language guide with every screenshot and a description
   - `docs/issues/README.md` (+ one file per non-trivial issue from `_template.md`): ID, severity, steps, evidence, cause
   - `docs/tasks/current_tasks.md`: plan before you start, tick items as you finish; archive a finished milestone as the next
     `prev_tasks_NN.md` and add it to `docs/tasks/index.md`
7. **Fix** defects that are clearly bugs and low risk (one commit each, with a test where the repo has a suite). Do **not**
   decide product or security policy yourself (password rules, enumeration, lockout, merge to master): list these as
   `DECISION NEEDED`.
8. Run `pnpm test:repo` before every commit; regenerate the ErhaPay inventory if customer-ui source changed. Push `dev`.

## Constraints
- Never touch `master`, force-push, or open/merge a PR without the owner's explicit instruction.
- Leave the owner's uncommitted formatting change in `apps/admin/app/layout.tsx` alone.
- Do not read, print or commit secrets, cookies or tokens; use only `@example.test` throwaway accounts, never the old demo
  accounts' passwords. Do not expose the stack publicly (no new tunnels) and mention if Funnel is still on.
- Do not kill the unrelated app on port 3000. Do not use `pkill -f` patterns that match your own command line.
- Prettier: config is `.prettierrc.json` (single quotes for api/worker/packages, double for the front ends). `pnpm format` / `pnpm format:check` cover only new code (review harness, guide page). Do NOT reformat existing source: about 59 regression tests and the invariant scanners match exact source text, and a full format broke them (tried and reverted on 2026-10-13). To format everything, first make those checks formatting-independent.
- Production is not approved; do not claim anything is release-ready.
- Report faithfully: if a check fails or was skipped, say so with the output.

## Definition of done
- Every customer route and admin page has at least one screenshot, a guide description and either "no issues" or an issue ID.
- Admin <-> customer cross-flows are tested and each breakage has an issue with reproduction steps.
- `docs/issues`, `docs/tasks`, `docs/guide`, `docs/screenshots` are mutually consistent and committed; `pnpm test:repo` passes.
- Final message: a short summary table (found / fixed / open / needs-owner-decision), links to the guide and issues, and what
  you did not get to.
