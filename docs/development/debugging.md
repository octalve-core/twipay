# Debugging Guide

Start from a request ID or user/session ID—not from raw secrets. Check structured application logs, `security_events`, health endpoints and database state. Do not paste tokens, BVNs, NINs, passwords or provider credentials into tickets.

For authentication failures: confirm origin policy, cookie presence, session status/expiry, CSRF cookie/header match, then security events. For dependency/build failures: verify Node 24, pnpm version and the lockfile before changing source code.
