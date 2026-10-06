# Authentication API

Base prefix: `/v1/auth`.

- `POST /register` — creates first-party account and opaque browser session.
- `POST /login` — validates password and creates a new session.
- `POST /logout` — revokes current session; requires CSRF protection.
- `GET /me` — resolves current session.
- `GET /csrf` — rotates and returns the current session CSRF token for in-memory use after a page reload.

Browser requests use `credentials: include`. No bearer token is returned for browser persistence. Unsafe authenticated requests send the readable CSRF cookie value in `X-CSRF-Token`; the real session cookie remains HttpOnly.
