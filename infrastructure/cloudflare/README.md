# Cloudflare production edge baseline

This is configuration guidance, not an API-token-bearing export. Never commit Cloudflare credentials, zone IDs tied to privileged automation, or account secrets.

## DNS/TLS

- Proxy `twipay.co`, `www.twipay.co`, `api.twipay.co`, and the isolated admin hostname through Cloudflare.
- Use **Full (strict)** TLS to validated origin certificates. Enforce TLS 1.2+ and prefer TLS 1.3.
- Redirect HTTP to HTTPS. HSTS is emitted by the applications only after the production hostnames are verified HTTPS-only.
- Do not proxy database, Redis, provider callback backchannels, or private management ports through public DNS.

## WAF and DDoS

- Enable Cloudflare managed WAF rules and DDoS protections.
- Challenge/block known bot/high-confidence automated abuse on auth, MFA, KYC and financial mutation paths; do not challenge signed provider webhook endpoints in a way that prevents providers from delivering.
- Restrict admin hostname by organization policy/IP/Access where operationally possible; API RBAC remains mandatory even behind edge controls.
- Treat edge rate limits as distributed first-line protection and the API's per-risk limits as defense in depth.

## Suggested rate-limit groups

Apply independent rules to login/register/recovery, MFA, KYC, transfer, utilities purchase, event checkout, refund/payout, and admin financial paths. Start conservatively, observe staging/load evidence, and tune without removing API-side limits. Webhook rules should rate-limit abusive floods while permitting legitimate provider retry bursts.

## Cache and headers

- Never cache authenticated API responses, `/v1/auth/*`, finance, KYC, ticket credential or operations responses.
- Preserve `Set-Cookie`, `Origin`, request IDs and webhook signature headers end-to-end.
- Do not rewrite CSP into a wildcard policy. Web/admin generate nonce CSP per request; API emits restrictive API-only headers.
