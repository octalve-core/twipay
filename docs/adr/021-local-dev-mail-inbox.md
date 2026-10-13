# ADR 021 — Local Development Email Inbox

**Status:** Accepted (local development only)

## Context
1. The only contact-verification channel is email, sent through the Resend adapter (`POST {RESEND_BASE_URL}/emails`).
   Without a real provider key nobody could register and then verify an account, so the dashboard and everything behind
   `contactVerified` was unreachable in a local or demo stack.
2. Using a real provider in development would send mail to arbitrary addresses and needs live credentials in a developer's `.env`.
3. A demo reached over a tunnel needs the verification code to be visible to the person demonstrating it.

## Decision
1. **Fake provider, no code changes in the API.** `infrastructure/dev-mail/server.mjs` is a dependency-free service that
   implements the one endpoint the adapter uses (`POST /emails`, bearer token required but not checked, idempotency keys
   honoured). `compose.stack.yaml` points the API and worker at it (`RESEND_BASE_URL=http://devmail:8025`) and
   overrides any `RESEND_*` values from `.env`, so nothing can leave the machine from this stack.
2. **Floating inbox in both front ends.** `infrastructure/dev-mail/widget.js` renders a button with an unseen badge and a
   panel of messages with the 6–8 digit code highlighted and copyable. It uses a shadow root, `textContent` only,
   `http(s)`-only links and a constructed stylesheet so it works under the admin's strict, nonce-based CSP.
3. **Same-origin, read/clear-only proxy.** The apps expose only `GET /__devmail/widget.js` and
   `GET|DELETE /__devmail/api/messages` (nginx for customer-ui, Next `rewrites` for admin). `POST /emails` is not reachable
   through the application origins, so no new port, CORS rule or iframe (the admin sends `X-Frame-Options: DENY`) is needed.
4. **Opt-in at build time.** `VITE_TWIPAY_DEV_MAIL` / `NEXT_PUBLIC_DEV_MAIL` default to `false` in the Dockerfiles; only
   `compose.stack.yaml` sets them to `true`. The admin script tag carries the request nonce.

## Consequences
- Registration, verification, password and PIN reset can be exercised end to end locally and through a tunnel.
- **Anyone who can open the apps can read every message, including every user's verification and reset codes.**
  Do not enable the widget or the proxy on a reachable staging or production deployment; keep the stack off the public
  internet unless that exposure is intended and time-boxed.
- Password-reset mail is queued and delivered by the worker's 60-second sweep, so it can arrive up to a minute after the
  request (registration mail is delivered inline).
- The inbox is in-memory plus a JSON file on a named volume (last 200 messages).
