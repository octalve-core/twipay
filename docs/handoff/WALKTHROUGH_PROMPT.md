# Product walkthrough: the reusable prompt (TwiPay)

Adapted from a prompt written for another product. It supersedes the "Procedure" part of
[NEXT_AGENT_PROMPT.md](NEXT_AGENT_PROMPT.md) for the full UI/UX review: that file still holds the state, gotchas and
file map, read it first. Task entry: [tasks/current_tasks.md](../tasks/current_tasks.md) section 3c.

**How to use:** copy the PARAMETERS block into the agent, fill the `<...>` gaps (a TwiPay draft is already filled in
below), and paste it above THE PROMPT. Nothing under THE PROMPT should need editing per module. If a rule is wrong
for a module, say so in the parameters instead of editing the prompt, so the next module still gets the lesson.

---

## PARAMETERS (TwiPay draft, fill the gaps)

```
PROJECT_NAME:        TwiPay customer app and admin console, end to end
MODULES_IN_SCOPE:    Customer UI: every route in apps/customer-ui/src/App.tsx (public pages, /auth/*,
                     /dashboard/*, /receipt). Admin: /login, /, /audit, /compliance, /config, /exceptions,
                     /financial-tiers, /notifications, /owner, /owner/customers, /owner/staff, /payouts,
                     /providers, /refunds, /reports, /security, /support.
ALSO_TOUCHED:        Dev email inbox, MFA enrolment/challenge, session and CSRF handling, worker-sent emails
                     (password reset), customer-action -> admin-queue flows (payouts, refunds, support,
                     compliance, exceptions, notifications).
OUT_OF_SCOPE:        Routes deliberately deferred (futureProductRoutes in apps/customer-ui/src/lib/constants.ts:
                     transfer-funds, international airtime/data, epin, esim, mobile-money, flights, hotels,
                     virtual cards, referral, affiliate): "Not walked: deferred by design". Real providers
                     (Paystack, Monnify, Mono, VTpass, Termii, Resend), Google sign-in: "Not demonstrable here".
REPOS_AND_BASES:     one repo (this one). Branch from master as walkthrough/<slug>; PRs target master. The
                     owner merges, you open.
COMMIT_PINS:         the exact HEAD sha of this repo under test, printed on the PDF title page.
DB_NAME:             wip_twipay_walkthrough (a new database inside the existing Postgres container; never the
                     `twipay` dev database).
PORTS:               <pick four free ones, e.g. API 4100, customer UI 3102, admin 3101, mail sink 8125; the
                     running dev stack already holds 4000, 3001, 3002, 8025, 5435, 6382, and 3000 belongs to an
                     unrelated app>
ROLES:               1. Customer A (sign up through the UI, verify via the dev inbox): shown registering,
                        verifying, using every dashboard page, resetting a password, logging out/in.
                        Refused: any /admin or owner route, another customer's data.
                     2. Customer B: a second customer, to show isolation and (if needed) the other side of an action.
                     3. Owner 1 and Owner 2 (SUPER_ADMIN, verified email, TOTP MFA enrolled): shown on every
                        admin page, doing maker then checker on an approval. Two DISTINCT owners are required.
                     4. Staff roles (SUPPORT_AGENT, FINANCE_OPERATOR, FINANCE_APPROVER, COMPLIANCE, OPERATIONS,
                        AUDITOR) created by an owner through /owner/staff: each shown reaching only its own pages.
                        Refused: pages outside its role.
EXTERNALS:           Email: local sink (the dev inbox in infrastructure/dev-mail, labelled as a sink).
                     Authenticator app: local TOTP simulator that computes the 6-digit code from the secret the
                     UI shows (labelled as a simulator). Everything else: "Not demonstrable here: <reason>".
BOOTSTRAP EXCEPTION: no UI creates the first SUPER_ADMIN (it is a row in `user_roles`). The harness's STAGE step
                     may insert that one role row for Owner 1 and Owner 2 after they have signed up and verified
                     by UI, prints the statement, and the PDF lists it under "Operator bootstrap (not a user
                     action)". It is the only allowed database write. Everything else is UI.
OUTPUT_ROOT:         /home/rojitech/Desktop/CODEC/OCTALVE/twipay/out/walkthrough/<slug>/ (gitignored `out/`).
                     Screenshots worth keeping are then promoted into docs/screenshots/<date>-walkthrough/.
TYPING_BUDGET:       12 minutes
```

---

## THE PROMPT

You are building a complete, honest walkthrough of **{{PROJECT_NAME}}**. Three deliverables:

1. `walkthrough.webm` and `walkthrough.mp4`: one continuous recording of the whole product in scope.
2. `walkthrough.pdf`: the same journey, one screenshot per step with a plain-language caption.
3. `findings.md`: the flow audit.

Work in five phases and **stop and report at the end of each** (what was done, what failed, what you need
decided). Do not run on into the next phase when the report contains a question for me.

- **P0 Plan.** Environment, guardrails, coverage matrix. No journey code yet.
- **P1 Recon.** Run the journey as many times as it takes to find where it breaks. Not a deliverable.
- **P2 Fix.** Fix the product (a regression test per fix), rerun.
- **P3 Final.** One strict, uninterrupted run from an empty database. Produces the deliverables.
- **P4 Ship.** Pull requests, docs, tracker.

### 1. The one rule: act like a real user

Every step of the journey is one of: click; type with real key presses at the speed of a very fast typist (18 to 45 ms a key; owner preference, 2026-11-06);
choose a file through the native file dialog; follow a link by clicking it; browser back and forward; sign
out and sign in as another role.

**Forbidden, and enforced by code (section 7), not by this paragraph:** SQL, Prisma or any database access
during the journey; API calls of any kind (`page.request`, `fetch`, `evaluate(fetch)`, curl, axios);
editing cookies, `localStorage` or `sessionStorage`; `page.goto()` after the first load of each tab; any
conditional (`if visible`, `isVisible()` guards, try/catch-and-continue); `test.skip`, `test.fixme`, retries.
Every step is a hard assertion. If a step fails the way a user would fail, the run fails, and that failure
is a finding. The only allowance is the BOOTSTRAP EXCEPTION in the parameters, done in the stage step.

**Actors versus observers.** The rule is about *actors*, the things that change what the app does. These
*observers* never change app state and are allowed: Playwright listeners for `console`, `pageerror`,
`requestfailed`, `response`; `@axe-core/playwright`; screenshots; video; the in-page caption bar and cursor
overlay (section 7); the labelled local sinks and simulators from `EXTERNALS`. If you are unsure which side
something is on, it is an actor, so it is forbidden.

**Waiting is not a conditional.** `await expect(locator).toBeVisible()` on a thing the journey knows will
appear is a hard assertion. `if (await x.isVisible())` is a guess, and a guess hides a finding.

### 2. Start state

- A fresh empty database named `{{DB_NAME}}` with the migrations applied and **no seed**. Never a `_test`
  database, never a shared one, never production, nothing else connected to it.
- Run `select current_database()` against it before the first write, every time. Env files have every
  value double-quoted (an unquoted `&` once sent a seed to the wrong database).
- A **production build** of the customer UI and admin, with their API URL baked in for the walkthrough ports
  (these are build-time values: rebuild if ports change). Build into a separate directory or image so it never
  clobbers the running dev stack.
- The recording starts at the first screen a brand-new visitor sees. Everything after that is created
  through the UI.
- Fictional names, `@example.test` addresses, throwaway passwords generated at run time and never printed.
- **Nothing may leave this machine.** Mail goes to the local sink, the browser may reach localhost only, and
  every blocked external request is itself a finding ("the app calls X").

**What the harness may do before the recording (the "stage" step).** Create and migrate the database, start
the API, worker, the two front ends and the sinks or simulators from `EXTERNALS`. It prints each command it
ran. It writes no application data, except the one allowed bootstrap row (see parameters) which happens after
those accounts exist.

### 3. Plan before code: `coverage-matrix.md`

Build it from the nav, every route in `App.tsx`, every `page.tsx` in `apps/admin/app`, every API controller
route, and the docs (handover, ADRs, `docs/issues`, tasks). One row per feature with: **Feature | Route | Roles
that can reach it | The click that proves it | API routes behind it | Status.** Compute the API column by reading
the controllers and the front-end API wrappers, so "an API route with no screen" is a computed list, not a guess.

- Status is `planned`, `ticked` or `not demonstrable`. **A tick is generated from `timeline.json`**
  (a step declares which row ids it covers), never edited by hand. The run fails if a row is `planned`.
- Every role needs **negative rows**: the thing it must be shown *not* being able to do, and what the user
  sees (hidden, a clear refusal, or "could not be found"). Absence is part of the product.
- Anything a browser cannot show goes on the PDF's "Not demonstrable here: <reason>" list. Never skip silently.

### 4. The journey

One browser context, one recording, one uninterrupted run, one viewport (1280 x 720). Sign out and in as
**each role in `ROLES`**, visit every nav item, every page, every modal and every action button by
clicking. After every action that should persist, **navigate away and back by clicking and re-read it**.
"It rendered" is not evidence; "it is still there after I left and came back" is.

Accounts for other roles are created through the UI. Verification codes and reset codes arrive by email: the
harness opens the local mail sink's viewer as a second tab (one `goto` per tab, counted separately by the guard)
and the journey reads the code and types it, like a person would. Deferred routes must be shown redirecting to
Services, once, as a documented behaviour.

### 5. What counts as a finding

Dead end, 404, a feature in code with no way to reach it in the UI, an API route with no screen; wrong,
confusing or misspelled wording; an empty state with no guidance; a state that needs a developer or SQL to
proceed; a click that does nothing, or a form that does not persist; console errors, failed requests,
hydration errors; axe violations (serious and critical block, the rest are listed); unstyled flash,
low contrast; a refusal that shows a status code or raw error code (e.g. `CONTACT_VERIFICATION_REQUIRED`)
instead of a sentence; an amount or balance that is wrong, fabricated or in the wrong unit (money is minor
units); two numbers on one screen that disagree; a customer action that never reaches the admin queue, or an
admin decision the customer never sees.

Each finding has: id (continue `ISS-NNN` in [docs/issues/README.md](../issues/README.md)), severity (S1 blocker,
S2 major, S3 minor/nit), route, what a user saw, the UI steps that reproduce it, evidence (screenshot, video
timestamp, console line), and a status of Fixed, Not fixed or Needs a decision.

### 6. The audit-and-fix loop

`RUN -> LOG -> FIX THE PRODUCT (with a test) -> RERUN`. Two kinds of run:

- **Recon runs (P1)** may use soft mode: a failed step is recorded as a finding and the run carries on to
  the next chapter, so one pass shows many problems. To avoid replaying early chapters, a recon run may
  restore a `pg_dump` snapshot taken at the start of a chapter. Recon runs and snapshots are evidence, kept
  in `_evidence/`, and **never the deliverable**.
- **The final run (P3)** is strict, from an empty database, with no snapshots and no soft mode, end to end.
  Only a green final run produces the deliverables.

Every fix needs a regression test that **fails on the old code** (prove it by breaking the fix on purpose
and watching the test fail). Fix the cause, not the symptom. Product and security policy is not yours to
decide (password rules, account enumeration, lockout, owner-bootstrap UX, merging to master): list it as
Needs a decision with the options and your recommendation. Existing open decisions: ISS-001, 002, 003.

### 7. Guardrails (build these first, in P0)

1. A separate Playwright config, `playwright.walkthrough.config.ts`, and `tests/walkthrough/`, outside the
   normal suites and outside `pnpm test:repo` and the offline regression run.
2. A `goto` wrapper that throws on a second call for the same tab.
3. `walkthrough.guard.test.ts`: greps the folder for `request`, `fetch`, `prisma`, `pg`, `.skip`, `.fixme`,
   `isVisible`, `try {`, `localStorage`, `sessionStorage`, `cookies` and fails on any hit outside an
   allowlisted observer/stage file. It is tamper-tested (add a forbidden line, see it fail).
4. Video legibility: a visible cursor, a click ripple, a caption bar drawn **inside the page** so it is in
   the recording by construction (works with no ffmpeg), typing delay 18 to 45 ms (very fast human).
5. `timeline.json`: `[{ id, chapter, role, name, covers: [rowIds], startMs, endMs, screenshot }]`. It
   generates the PDF captions, the coverage ticks, `chapters.vtt` and `chapters.json`.
6. If `ffmpeg` exists, also make `walkthrough.mp4` with chapters. If it does not, say so; do not add it as a
   project dependency (install it under the scratchpad if you need it), and do not pretend an mp4 exists.
7. Observers always on: console, pageerror, requestfailed, response status, and axe after every new route.
8. The repository scanners ban `console.*` in app code and match exact source text in ~59 regression tests:
   keep the harness outside `apps/`, do not reformat existing source with Prettier, and run `pnpm test:repo`
   before every commit.

### 8. Deliverables, saved under `{{OUTPUT_ROOT}}` (gitignored)

`walkthrough.webm`, `walkthrough.mp4` (if possible), `walkthrough.pdf`, `findings.md`, `timeline.json`,
`chapters.vtt`, `coverage-matrix.md` (all ticked), `screenshots/`, `_evidence/<run-id>/` for every other run.
The PDF has: title page (project, date, **the commit SHA**), contents, timeline, one screenshot and caption
per step, the coverage matrix, the "Not demonstrable here" and "Operator bootstrap" lists, and the findings
table with its status. Afterwards promote the curated screenshots into `docs/screenshots/<date>-walkthrough/`,
list them in `apps/customer-ui/src/routes/external-pages/guideData.ts` (the dev-only `/guide` page) and in
`docs/guide/README.md`, and add the findings to `docs/issues/README.md`.

Shipping (P4): the harness (config, `tests/walkthrough/`, guard test) goes in as its own PR; each fix is its
own commit; docs are updated in the same PR as the change they describe. **I merge. You open.** Commit
messages and PR bodies carry the attribution lines from your system reminder.

### 9. Done when

- The coverage matrix is 100% ticked by one green, uninterrupted, strict run from an empty database.
- Every finding is Fixed, or listed with its reason and the decision needed.
- `walkthrough.guard.test.ts` is green and tamper-tested.
- `pnpm test:repo`, `pnpm test:offline-regression`, the admin tests and the `@twipay/api` typecheck pass on the final
  commit (say which were run and which were only read, and how long they took). `@twipay/customer-ui` has 30
  known type errors (ISS-014): do not make the count worse.
- `docs/tasks/current_tasks.md`, `docs/issues/README.md`, `docs/guide/` and memory are updated from the new state.

### 10. House rules that apply to every module

- Use absolute paths and `git -C`. Create worktrees under `.worktrees/` by absolute path and remove them
  when the work is done unless I say otherwise. **Write deliverables to the main checkout's `out/`, not to a
  worktree.**
- Kill servers by pid (`ss -ltnp`), never `pkill -f` or `pgrep -f` (they match your own shell).
- Drop only databases you created, after `pg_stat_activity` shows no connection. Never touch the `twipay` dev
  database, nor any other project's database or containers on this machine.
- Login and registration share one limit: 10 per minute per IP, in memory, and repeat offenders are banned for
  the window; restart the walkthrough API before the run and pace the journey. Sessions rotate, so never reuse a
  saved session across runs.
- Use the same hostname for UI, admin and API (cookies are `SameSite=Strict`).
- The owner area is fail-closed: verified contact + SUPER_ADMIN + MFA, and approvals need two distinct owners.
- A timeout is contention; a failed assertion is a defect. Check which it is before you retry.
- Never commit secrets; Funnel/tunnels stay off unless I ask. Report what was run versus only read.
