# Identity and Session Architecture

TwiPay owns the user record. External OIDC providers link identities to that record.

## Browser sessions
- Opaque 256-bit random session token.
- Browser receives token only in an HttpOnly cookie.
- Database stores only SHA-256 hash combined with a server-only pepper.
- Session cookie uses Secure + SameSite=Strict in production.
- CSRF token is a separate random value with only its hash stored server-side; unsafe requests will require the matching header once interactive forms are wired.
- Session revocation is server-side and immediate.

## Passwords
Argon2id; 12-128 character policy; no composition rule. Breached-password screening can be added before public launch without altering credential storage.

## Google
Authorization Code + PKCE. State and verifier must be server-side/short-lived. Google subject (`sub`) is the immutable external identifier, not email alone.
