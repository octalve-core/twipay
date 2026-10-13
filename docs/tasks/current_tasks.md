# Current Operational & Deployment Tasks

- **Workstream Code:** `TASK-CURRENT`
- **Start Date:** `2026-10-13`
- **Status:** `IN_PROGRESS`
- **Lead / Execution:** TwiPay Platform Engineering
- **Previous milestone:** [prev_tasks_04.md](prev_tasks_04.md) (phase 3 merge, Docker stack, dev inbox, auth review)

---

## 1. Runtime (local Docker stack)
How to run it: [../development/docker-stack.md](../development/docker-stack.md).

- [x] `compose.stack.yaml`: postgres 18, redis 8, migrate, api, worker, admin, customer-ui, devmail — all healthy.
- [x] Remote access through Tailscale Funnel verified over the public relay (customer UI 443, admin 8443, API 10000).
- [!] While Funnel is on, anyone with the link can read the dev inbox (codes included). Turn it off after a demo:
      `sudo tailscale funnel reset`.

### Demo accounts
`demo@twipay.com` (customer) and `admin@twipay.com` (`SUPER_ADMIN`). Both are email-unverified, have no MFA, and the
owner area stays blocked for the admin until its contact is verified. Their passwords were recorded in earlier versions of
this file (see git history): **rotate them before any shared or public use**, and give outside testers a throwaway account.

---

## 2. Authentication follow-ups
Details and impact: [../security/auth-review-2026-10-13.md](../security/auth-review-2026-10-13.md).

- [ ] Password policy: deny-list of common passwords; make the reset screen's rules match the server.
- [ ] Decide registration enumeration behaviour (`409 ACCOUNT_ALREADY_EXISTS` vs neutral response).
- [ ] Per-account lockout / shared rate-limit store.
- [ ] Verify `Secure` cookies in production builds.
- [ ] Admin email-verification path and readable `CONTACT_VERIFICATION_REQUIRED` message.
- [ ] Use `authErrorMessage` in every form (logout and others still read `errData.message`).
- [/] `/auth/user-details` profile step: exercise it and fix the two reported type mismatches.

---

## 3. Build & repository hygiene
- [ ] `@twipay/customer-ui`: 30 type errors (26 unused declarations, 4 mismatches) block `tsc -b` in the image build.
- [x] `new/` checkout deleted (its history is in `dev`); `pnpm test:repo` passes with no scanner findings.
- [x] `dev` pushed to `origin/dev` (112 commits ahead of `origin/master`).
- [ ] Open the pull request `dev` -> `master` and get it reviewed (https://github.com/octalve-core/twipay/pull/new/dev).
- [ ] CI: run the repository's own workflows against the merged branch.

---

## 4. Pending / In-Flight Backlog (unchanged)
- [ ] **MFA Step-Up UI Flow**: TOTP QR enrollment and recovery code generation in the customer profile and ops console.
- [ ] **Provider Sandbox Verification**: sandbox funding with Paystack and Monnify, utility and ticket flows.
- [ ] Qualification gates listed in `docs/release/security-gates.md` (production remains NOT approved).
