# TwiPay Phase 2 / Batch 2.5 — ErhaPay-derived Missing-Page Foundations

## Authoritative baseline and scope
- Integrate into **one** Git-backed TwiPay monorepo. The customer-facing visual standard is the original ErhaPay React/Vite code, not the archived simplified Next.js customer app.
- Started from Phase 2.4 `bff5b51c9375c3ee0f65a0a3987becb33cf4b25b`.
- New pages only. Preserve existing dashboard shell, navigation, original temporary ErhaPay logo, all original image assets, authentication/MFA boundary, and disabled financial operations.
- **No backend or database changes, feature flag changes, payment operations, QR credentials or fabricated customer data in Batch 2.5.**
- New wording is friendly, customer-facing and truthful; implementation notes belong in docs, not fintech screens.

## Exact ErhaPay visual reuse
- `ErhaPageFrame`, `ErhaPageHeading`, `ErhaSettingsPanel` from the previous approved source-derived design system.
- Additive `ErhaFoundationUI.tsx` wraps those primitives. Existing green `#112929`, body `#344054`, secondary `#667085`, ErhaPay background `#F9FAFB`, familiar border `#F0F2F5`, 588px settings content width, existing fixed desktop/sidebar mobile navigation and responsive typography.
- Links use the existing React Router and current authenticated dashboard shell. Every unavailable action is a **noninteractive message**, not a fake submit button.
- Original old routes remain in source. The inventory now counts 65 route declarations (previous 59 + six reviewed additions).

## New protected routes and behaviour

| Route | Behaviour | Backend fact / qualification |
|---|---|---|
| `/dashboard/settings/security-overview` | Security summary linking existing TOTP/identity pages; PIN and device controls pending | No PIN endpoint wired; mandatory secure server PIN belongs to Phase 3/4 |
| `/dashboard/settings/beneficiaries` | Read-only foundation; no invented stored beneficiaries | Secure beneficiary CRUD and step-up authorization pending Phase 4 |
| `/dashboard/settings/notification-preferences` | Links existing notification **delivery history**; noninteractive preferences | No saved read/unread/preference API yet; Phase 5 |
| `/dashboard/settings/support-centre` | Links actual financial disputes and FAQs; general support pending | General support cases/conversations and evidence storage pending Phase 5 |
| `/dashboard/my-tickets` | React Query `listEventOrders()` displays only owner-scoped, parsed real orders, exact BigInt NGN amounts, actual statuses and public ticket codes | No ticket QR credential retrieved. Backend ticket QR gate remains off. Phase 5 security/browser tests outstanding |
| `/dashboard/organizer` | React Query `GET /v1/events/organizers/me`; bounded, typed projection to `id,name,slug,status,eventCount` | Owner-scoped API exists. No settlement amount, bank data, fake organizer records, creation or payout actions; Phase 5 |

### Navigation integration
- Existing Settings screen now links the two overview pages for account security and help instead of duplicating the old buttons. Existing `/dashboard/settings/security` and `/dashboard/settings/support` remain accessible from their respective overview.
- Settings also includes saved beneficiaries, notification preferences, My Tickets and Organizer Centre. Existing sidebar/mobile layout is untouched.
- No route enables email-to-user transfers, deferred travel/virtual card/affiliate features or permanently excluded betting.

## Privacy, authorization and financial protection
- All six routes are children of `DashboardLayout`, which wraps them with `AuthenticatedCustomerRoute` and requires a completed session and MFA where applicable.
- Organizer GET allowlist entry is exact, not a wildcard to add mutation endpoints. `EventService.listOrganizersForUser()` takes `requirePrincipal(req).userId`. Adapter validates record count ≤50 and basic field shapes; discards sensitive additional fields.
- My Tickets uses existing owner-scoped `GET /v1/events/orders` and `readEventOrder` status validation. It **never** calls `.../credential`; no QR payloads, generated graphics, localStorage or transaction mutations. A PAID record is shown based on returned backend state only.
- Order empty/error/loading states are distinct. No fake success, metrics, discounts, unread counts, payment quotes or proof of admission.
- This source contract does not prove runtime authorization: continue with actual Node 24/PostgreSQL/Redis/browser and permission tests.

## Source and browser verification
- `node --experimental-strip-types --test docs/migration/test/*.test.mjs docs/integration/test/*.test.mjs docs/design/test/*.test.mjs scripts/test/*.test.mjs`
- `node scripts/design/erhapay-ui-inventory.mjs --check`
- `node scripts/typescript-syntax-check.mjs`
- `node scripts/repository-security-check.mjs`
- `node scripts/architecture-check.mjs`
- `node scripts/financial-invariant-check.mjs`
- `node scripts/services-events-invariant-check.mjs`
- `node scripts/product-operations-invariant-check.mjs`
- `node scripts/production-hardening-invariant-check.mjs`
- `node scripts/git-history-secret-check.mjs`
- Playwright browser spec `tests/e2e/customer-ui/phase2-foundations-readonly.spec.ts` is written but not executed here.

## Next dependent batches
- **Phase 2.6** actual original-ErhaPay visual screenshot baselines across approved viewports.
- **Phase 3** password recovery, Google authorization-code + PKCE OIDC, session security, KYC, secure backend-enforced mandatory transaction PIN configuration and recovery.
- **Phase 4** saved beneficiary CRUD, wallet-to-wallet transfers, server quotes and financial qualification with real database locks.
- **Phase 5** customer notification preferences, general support tickets, organizer/event CRUD, authorized QR and staff check-in, settlement-status views.
- **Phase 6** real full builds, browser/mobile E2E, database/provider/worker tests and release approval; Phase 1 runtime gates remain **BLOCKED**, not passed.
