# ADR 003 — Opaque Browser Sessions

**Status:** Accepted

Web authentication uses opaque server-revocable sessions in HttpOnly cookies rather than long-lived JWTs in browser storage. This reduces token exposure to XSS and gives immediate revocation. JWT remains available later for short-lived mobile/partner/service claims with strict issuer/audience/algorithm rules.
