import { randomBytes } from 'node:crypto';
import type { BrowserContext, Page } from '@playwright/test';
import type { createTimeline } from './timeline.js';

export interface Person { given: string; family: string; email: string; password: string }

export interface World {
  context: BrowserContext;
  page: Page; // the customer tab
  pages: { customer: Page | undefined; admin: Page | undefined }; // `pages.admin` is opened by the first admin step
  ui: string;
  admin: string;
  step: ReturnType<typeof createTimeline>['step'];
  people: Record<string, Person>;
  observations: unknown[]; // shared sink for console/network observations of every tab
  startedAt: number;
  opened: Record<string, number>; // epoch ms at which each tab was opened: its recording starts then, so the videos can be cut together by the timeline
  secrets: Record<string, string>; // authenticator secrets shown by the UI during MFA enrolment, kept in memory only
}

const run = Date.now().toString(36);

// Fictional names, .example addresses, throwaway passwords generated now and never printed or stored.
export function person(key: string, given: string, family: string): Person {
  return {
    given,
    family,
    email: `${key}.${run}@twipay.example`,
    password: `Wt-${randomBytes(9).toString('base64url')}-7q`,
  };
}

export const cast = (): Record<string, Person> => ({
  ada: person('ada', 'Ada', 'Okafor'),
  ben: person('ben', 'Ben', 'Adeyemi'),
  owner1: person('owner1', 'Ngozi', 'Eze'),
  owner2: person('owner2', 'Tunde', 'Bello'),
  support: person('support', 'Sade', 'Support'),
  financeOp: person('financeop', 'Femi', 'Operator'),
  financeAp: person('financeap', 'Fola', 'Approver'),
  compliance: person('compliance', 'Chidi', 'Compliance'),
  operations: person('operations', 'Obi', 'Operations'),
  auditor: person('auditor', 'Amaka', 'Auditor'),
});
