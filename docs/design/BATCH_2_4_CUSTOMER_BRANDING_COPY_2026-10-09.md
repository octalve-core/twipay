# TwiPay Phase 2 / Batch 2.4 — Customer Branding & Entry-Point Copy

Date: 2026-10-09 (Africa/Lagos). Input Git baseline: `891e7b05ec462f0b3f787a6ab55574ebad974d8e`.

## Decision and scope

**Customer-facing copy must sound like a real consumer fintech, not an architecture document.** Use everyday English, warm greetings, direct instructions, truthful transaction status and concise helpful errors. Do **not** put "sandbox", "CSRF", "HttpOnly", "localStorage", "idempotency", "ledger", internal platform architecture or development/release qualifications on customer screens. Those terms remain appropriate in source identifiers, feature switches, tests, engineering documentation and operational diagnostics.

This is **not** an authorization to claim an unqualified financial service works, disguise a pending transaction as paid, or enable payments. If a service is disabled, write **"temporarily unavailable"** and say what the customer can still do. Internal default-off feature flags and server-side restrictions are unchanged.

**Visual authority:** original ErhaPay React/Vite customer UI. Preserve temporary original logo and visual assets, Aeonik fonts, colors, route declarations, dashboard components, layouts and responsive conventions. `apps/web` Next.js remains a historical reference; its high-visibility infrastructure prose was also adjusted because it may have been shown during earlier demos, but it is not the deployment target.

## Applied changes

| Customer touchpoint | Before | After / justification |
|---|---|---|
| Login | Some old Next.js pages explained HttpOnly/localStorage cookies | "Welcome back" / "Jump right back in and pick up where you left off." Keep credentials in secured session controls without explaining mechanism. |
| Registration | "User created successfully", disabled referral form labelled "not yet available" | Warm welcome and removal of inactive referral field; referral backend stays deferred. |
| Password assistance | Disabled "Forgot password? (not yet available)" or pretend links | "Need help? Browse FAQs" to an existing public route; password recovery remains Phase 3. |
| Public landing | "Our MVP is live", "number 1 VTU", dummy mobile store buttons | "Everyday payments, made simpler", actual signup/login links, no unverified store availability. |
| Partner section | Claimed partnerships with the world's largest companies | Neutral "Made for your everyday essentials" copy; historical logos remain on disk but are no longer represented as verified partners. |
| Testimonial | Named ErhaPay testimonial without supporting approval/evidence | Brand-value section without fabricated quote or attributed person. |
| Public feature copy | Repeated generic mission paragraph, unsupported free-trial FAQ | Clear feature-specific descriptions and source-grounded FAQ examples; deferred referral/card marketing still filtered. |
| Add funds, bank payouts, virtual accounts, utilities, events | Explained sandbox/security qualification to customers | Honest, concise temporary-unavailability notices while **same gates remain disabled**. |
| KYC | Explained API/browser storage internals | Clear purpose of identity verification and consent retained. |
| Transaction records | Showed "ledger-backed", "reconciliation" or technical retry language | Human-readable status checking and explicit warnings against duplicate payment. |
| Public contact form | Existing handler was a no-op; "Send message" could misleadingly imply delivery | Form is disabled with notice; authenticated financial disputes remain available in account settings, general support API is Phase 5. |
| Legacy Next.js reference screens | Exposed architecture and maker/checker terminology | Selected user-visible strings adapted; architecture logic untouched; still not authoritative UI. |
| Entry metadata | Bare title only | TwiPay title and ordinary SEO description; legacy favicon retained temporarily per instruction. |
| Frontend API errors | Technical implementation or migration details in thrown messages | Plain language, **internal error codes and route allowlist unchanged**. |

## Non-negotiable truthfulness and security

- No actual checkout, funding, bank transfer, bill purchase, virtual account provision or ticket purchase has been enabled as part of this batch.
- Real provider state, account identity, balances, fees and transaction statuses still come only from authenticated backend responses.
- No unsupported “instant”, “number one”, blanket “100% secure”, free trials, app-store availability, specific partners, named testimonials or payment success has been invented.
- Financial quote, pending/unknown outcome, same-intent retry protection, MFA, CSRF, owner scoping and backend validation remain enforced independently of the copy.
- The public contact message workflow remains unavailable until a real authenticated/unauthenticated support contract is implemented; disabling it is intentional and prevents false success.
- Original visual images were not edited. Removal of unverified logos, testimonial/avatar, app-store links and unavailable referral controls from **rendered content** changes some layouts intentionally; requires owner screenshot review once runtime is available.

## Future copy and UI rules

1. **Lead with a human benefit:** “Welcome back”, “View your transactions”, “Review your transfer”, “Check payment status”.
2. **Explain what is possible today:** never advertise a disabled financial action as active, even with promotional language.
3. **Keep technical terms out of customer copy:** explain actionable next steps, not cookies/providers/architecture.
4. **Make financial states precise:** “Pending” != paid; never show a paid receipt for unresolved payment.
5. **No dead buttons:** store badges, contact and unverified social proof are not published as operational links.
6. **Preserve ErhaPay design consistency:** no new fonts, palette, cards, routing shell or backend auth model in a branding/copy task.
7. **Do not change the original logo yet:** final TwiPay visual identity is a separate approved checkpoint.

## Verification and limitations

Run: `node --experimental-strip-types --test docs/migration/test/*.test.mjs docs/qualification/*.test.mjs docs/integration/test/*.test.mjs docs/design/test/*.test.mjs`; `node scripts/design/erhapay-ui-inventory.mjs --check`; the standard source-security/financial scanners and `git diff --check`. See accompanying `BATCH_2_4_VERIFICATION.md` for actual results.

**Not performed:** dependency-backed Vite or Next.js build (Node 24/pnpm/lockfile prerequisite), real ErhaPay browser screenshots, visual parity and full accessibility/browser E2E, PostgreSQL/Redis/provider integration. Phase 1 cannot be signed off by copy/tests alone. Google OIDC and mandatory server-enforced transaction PIN remain approved Phase 3/4 work.
