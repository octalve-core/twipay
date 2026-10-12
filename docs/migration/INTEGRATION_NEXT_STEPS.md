# TwiPay ErhaPay UX integration — controlled next stages

Do **not** replace `apps/web` with the new isolated `apps/customer-ui` directory until real browser, security and visual parity evidence is available. The Vite app is a preservation candidate; if the project ultimately requires Next.js, migrate the actual ErhaPay components into a Next.js runtime with screenshot parity rather than redesigning.

1. **Authentication acceptance (immediate):** install dependencies on Node 24 and the real pinned pnpm version; launch API/PostgreSQL on developer machine; check exact APP_URL, cookie host, HTTPS production settings, CORS and CSRF; test register, logout, cookie restoration, enrolled MFA challenge, stale session, duplicate form submits, 401/403/429 and browser storage.
2. **Auth settings extension:** implement UI for actual TwiPay MFA enrollment/confirmation/recovery code storage warnings, profile editing, reset/verification only after backing contracts exist. Do not reinstate ErhaPay's emailed OTP model or Firebase token flow by copying old code.
3. **Wallet and payments:** map ErhaPay components to real `GET /v1/wallets`, transaction/funding/transfer contracts with integer minor units, persistent idempotency keys per logical action, final-provider evidence and UNKNOWN reconciliation. Keep financial UI disabled until qualification.
4. **Utilities/events:** preserve the original page structures but replace dummy/service API integrations only after TwiPay provider contracts are verified. Validate ticket capacity and QR ownership/check-in.
5. **Future modules:** preserve and keep inactive e-PIN, international airtime/data, eSIM/mobile money, virtual card, flight/hotel booking, referrals/affiliate. Betting is excluded permanently and is never a roadmap candidate.
6. **Visual/security review:** screenshot compare original ErhaPay and integrated TwiPay across desktop/tablet/mobile, perform accessibility review and true application e2e/security tests. Then swap routing/runtime only as an independently reviewed release decision.

No unrestricted client-to-provider credentials; no writable wallet balance in UI; no temporary fake financial accounts or live values. Preserve immutable double-entry accounting, secure sessions, CSRF, recent MFA, RBAC and all recorded TwiPay backend controls.
