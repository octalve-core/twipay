# Policy decisions needed (ISS-001, ISS-002, ISS-003)

These change what a customer sees or what the product promises, so they are for the owner to decide, not for an engineer or an agent. Each has
the options, what each costs, and a recommendation. Source: [auth review 2026-10-13](../security/auth-review-2026-10-13.md); status in
[README.md](README.md). Nothing here has been changed in the code.

## ISS-001: password rules

**Today.** Length only, 12 to 128 characters. `aaaaaaaaaaaa`, `123456789012` and `password1234` are accepted. The reset screen shows an
"uppercase" rule the server does not enforce, and the sign-up screen shows none, so the screens and the server disagree.

| Option | What a customer sees | Cost |
| :-- | :-- | :-- |
| A. Keep length only, make every screen say so | "At least 12 characters" everywhere | Smallest change; weak passwords stay allowed |
| B. Length plus a block-list of common and breached passwords, and no password containing the email name | Same screens; a clear message when the password is too common | A small list shipped with the API; no change to what people type for good passwords |
| C. Composition rules (upper, lower, digit, symbol) | Rule checklist on every screen | Current guidance (NIST SP 800-63B) advises against composition rules: they push people to predictable patterns |

**Recommendation: B.** It stops the real problem (guessable passwords) without annoying people with good ones, and one shared rule
(`packages/security validatePasswordPolicy`) removes the screen/server mismatch. Remove the "uppercase" line from the reset screen in the same change.

## ISS-002: registering with an email that already has an account

**Today.** The API answers `409 ACCOUNT_ALREADY_EXISTS`, so anyone can find out which emails are registered. Password reset is already built
the other way round (same answer either way).

| Option | What a customer sees | Cost |
| :-- | :-- | :-- |
| A. Keep the clear message | "This email is already registered. Log in." | Best experience; leaks which emails have accounts (rate limiting only slows it) |
| B. Neutral answer | "Check your email to continue" for everyone; the owner of an existing account gets an email saying someone tried to register | Hides the list; a person who forgot they had an account sees no on-screen hint and must read the email; needs the email path to be reliable |

**Recommendation: B for a payments product**, because the list of registered emails is useful to phishers. If email delivery is not yet
dependable in production, do A now and B when it is, and say so in the privacy notice.

## ISS-003: lockout and guessing limits

**Today.** The only brake is 10 sign-in or sign-up attempts a minute per IP address, kept in memory in each API process. A slow guesser spread
over many addresses, or over several API instances, is not limited at all.

| Option | What a customer sees | Cost |
| :-- | :-- | :-- |
| A. Keep the per-IP limit | Nothing new | A distributed guesser is not slowed |
| B. Per-account back-off in Redis: after N wrong passwords the account waits 1, 2, 4, ... minutes (no hard lock) | A "try again in N minutes" message after repeated mistakes | Needs the shared store to be qualified; an attacker can make a victim wait (mitigated by keeping the wait short and by keying on the account plus a hash of the network) |
| C. Hard lock after N failures until the owner resets by email | Locked account and a reset email | Easy to abuse to lock people out; more support load |

**Recommendation: B**, with the limits kept as product settings (N around 5, wait capped at 15 minutes) and the same message for a wrong
password and for an unknown email. Staff accounts already require MFA, so this mainly protects customer accounts.

## What I need from you

For each item: A, B or C (or "something else"). Once you choose, each is a small change with a regression test that fails on the old code.
