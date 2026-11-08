import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from '@playwright/test';
import type { Observation } from './lib/observers.js';
import type { createTimeline as CreateTimeline } from './lib/timeline.js';
import { visitorChapter } from './chapters/visitor.js';
import { customerActions } from './chapters/customer-actions.js';
import { customerSecurity, customerSettings, customerSignUp, customerTour } from './chapters/customer.js';
import { adminTour } from './chapters/admin-tour.js';
import { ownersChapter } from './chapters/owners.js';
import { staffGovernance } from './chapters/staff.js';
import { staffSessions } from './chapters/staff-sessions.js';
import { supportRoundTrip } from './chapters/support.js';
import { suspensionChapter } from './chapters/suspension.js';
import { signUpEveryone } from './chapters/people.js';
import { firstLoad } from './lib/nav.js';
import { installOverlay } from './lib/overlay.js';
import { idleSpans } from './lib/idle.js';
import { observe } from './lib/observers.js';
import { assertModeIsSane, failures, loadState, saveState } from './lib/soft.js';
import type { Person, World } from './lib/world.js';
import { createTimeline } from './lib/timeline.js';
import { cast } from './lib/world.js';

// The product walkthrough: one browser context, one recording, one tab, one run. See README.md and docs/handoff/WALKTHROUGH_PROMPT.md.
const outputRoot = process.env['WT_OUTPUT_ROOT'] ?? 'out/walkthrough/run';

let saved: { timeline: ReturnType<typeof CreateTimeline>; observations: Observation[]; world: World } | undefined;
const statePath = 'out/walkthrough/recon-state.json';

// Runs even when a step fails, so a failed run still leaves its timeline and observations as evidence.
test.afterEach(() => {
  if (!saved) return;
  saved.timeline.write();
  saveState(statePath, { people: saved.world.people, secrets: saved.world.secrets });
  writeFileSync(join(outputRoot, 'idle.json'), `${JSON.stringify(idleSpans)}\n`);
  writeFileSync(join(outputRoot, 'tabs.json'), `${JSON.stringify({ timelineStartedAt: saved.timeline.startedAt, opened: saved.world.opened })}\n`);
  writeFileSync(join(outputRoot, 'observations.json'), `${JSON.stringify({ failures, observations: saved.observations }, null, 2)}\n`);
});

// Soft recon only: WT_CHAPTERS=owners,... re-runs later chapters against the people created by an earlier soft run.
const chosen = (process.env['WT_CHAPTERS'] ?? '').split(',').filter(Boolean);
const wanted = (name: string) => chosen.length === 0 || chosen.includes(name);

test('TwiPay product walkthrough', async ({ page, context }) => {
  assertModeIsSane();
  mkdirSync(outputRoot, { recursive: true });
  await installOverlay(context);
  const started = Date.now();
  const observations = observe(page, started);
  const pages: World['pages'] = { customer: page, admin: undefined };
  const timeline = createTimeline(pages, outputRoot);
  const world: World = {
    context,
    page,
    pages,
    ui: process.env['WT_UI_ORIGIN'] ?? 'http://localhost:3102',
    admin: process.env['WT_ADMIN_ORIGIN'] ?? 'http://localhost:3101',
    step: timeline.step,
    people: cast(),
    secrets: {},
    observations,
    startedAt: started,
    opened: { customer: started },
  };
  const remembered = chosen.length ? loadState(statePath) : undefined;
  if (remembered) {
    world.people = remembered.people as Record<string, Person>;
    world.secrets = remembered.secrets;
  }
  saved = { timeline, observations, world };
  if (!wanted('visitor')) await firstLoad(page, `${world.ui}/auth/login`); // recon only: later chapters re-run without the visitor chapter
  if (wanted('visitor')) await visitorChapter(world);
  if (wanted('customer')) {
    await customerSignUp(world);
    await customerTour(world);
    await customerActions(world);
    await customerSettings(world);
    await customerSecurity(world);
  }
  if (wanted('people')) await signUpEveryone(world);
  if (wanted('owners')) await ownersChapter(world);
  if (wanted('admin-tour')) await adminTour(world);
  if (wanted('staff')) await staffGovernance(world);
  if (wanted('staff-sessions')) await staffSessions(world);
  if (wanted('support')) await supportRoundTrip(world);
  if (wanted('suspension')) await suspensionChapter(world);
});
