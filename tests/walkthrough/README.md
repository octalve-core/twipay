# Walkthrough harness

Implements phases P0 to P3 of [docs/handoff/WALKTHROUGH_PROMPT.md](../../docs/handoff/WALKTHROUGH_PROMPT.md). Outside every normal
suite and outside `pnpm test:repo`. Deliverables go to the gitignored `out/walkthrough/<slug>/`.

| Piece | File | Notes |
| :-- | :-- | :-- |
| Config | `playwright.walkthrough.config.ts` | 1280x720, video on, no retries, no timeout (one uninterrupted run) |
| Isolated stack | `compose.walkthrough.yaml`, `stage.mjs` | own project `twipay-wt`, own Postgres (`wip_twipay_walkthrough`, tmpfs so it always starts empty), Redis, worker, mail sink (read through the floating inbox button inside the apps, so the journey stays in one tab and one video); ports 3102 UI, 3101 admin, 4100 API, 8125 mail, 5436 PG, 6383 Redis. Never touches the dev stack or its `twipay` database |
| Rules | `lib/nav.ts` (goto once per tab), `lib/human.ts` (50-120 ms key presses), `guard-rules.mjs` + `walkthrough.guard.test.mjs` (forbidden code, tamper-tested) | |
| Observers | `lib/overlay.ts` (cursor, ripple, caption bar), `lib/observers.ts` (console, pageerror, requestfailed, 4xx/5xx) | not actors |
| Timeline | `lib/timeline.ts` | `step()` records `timeline.json`, screenshots and which coverage rows a step proves |
| Simulators and stage | `lib/authenticator.ts` (TOTP, RFC 6238 vector tested), `lib/stage.ts` (the one allowed DB write: `SUPER_ADMIN` role rows for two owners) | labelled as such in the video and PDF |
| Coverage | `matrix/rows.json`, `matrix/build-matrix.mjs`, `matrix/coverage.test.mjs` | rows are curated; routes, admin pages, nav permissions and API controllers are read from the code and the tests fail when a route or API route has no row |

## Commands
```bash
pnpm test:walkthrough-guards       # guard + coverage tests (fast, no browser)
pnpm walkthrough:selftest          # drives the harness against a data: page, checks overlay/timeline/typing/goto rule
pnpm walkthrough:matrix            # writes out/walkthrough/run/coverage-matrix.md (ticks come from timeline.json)
pnpm walkthrough:stage up|down     # build and start / destroy the isolated stack (slow first build)
pnpm walkthrough:stage up --fresh # an empty database every time: MFA credentials cannot be deleted, so a stack is used for one run

# soft recon (a failed step is recorded and the run carries on; evidence only, never a deliverable)
WT_SOFT=1 WT_OUTPUT_ROOT=out/walkthrough/recon-run-N pnpm exec playwright test -c playwright.walkthrough.config.ts
# the final run: strict, uninterrupted, from an empty database
WT_FINAL=1 WT_OUTPUT_ROOT=out/walkthrough/final pnpm exec playwright test -c playwright.walkthrough.config.ts
# deliverables from a green final run (refuses a soft or failed run or an unticked row)
node tests/walkthrough/build-artifacts.mjs --out out/walkthrough/final --sha "$(git rev-parse --short HEAD)"
```

`build-artifacts.mjs` writes `coverage-matrix.md`, `chapters.json`, `chapters.vtt`, `findings.md`, `walkthrough.pdf`
(title page with the commit, contents, timeline, one screenshot per step, matrix, "Not demonstrable here", "Operator
bootstrap", findings) and `walkthrough.mp4` / `walkthrough.webm` (the customer and admin recordings cut together by the
timeline, with chapters). Needs ffmpeg (`FFMPEG=/path/to/ffmpeg` if it is not at `~/.local/bin/ffmpeg`). `--dry-run` checks the
layout on a soft run and stamps the PDF DRAFT.

## Candidate findings noticed while planning (verify in recon)
- Admin nav (`apps/admin/app/_components/ops-shell.tsx`) has hard-coded badge values (`3`, `4`, `2`, `6`, `99.8%`): fabricated numbers.
- `/payouts/create` ("Batch Calculator") exists in the admin but was not in earlier page lists.
- Admin `/security` has no permission requirement, so any signed-in staff user reaches it (probably intended).
- Customer funding, transfers, bills, events checkout and virtual accounts are behind sandbox flags and provider keys; with the stack
  defaults they will show their disabled state (see `gatedBy` in the matrix and the decision in the P0 report).
