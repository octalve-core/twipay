import { defineConfig } from '@playwright/test';

// Walkthrough harness: separate from every normal suite and from `pnpm test:repo`. Run with
//   pnpm exec playwright test -c playwright.walkthrough.config.ts
// See tests/walkthrough/README.md and docs/handoff/WALKTHROUGH_PROMPT.md.
const outputRoot = process.env['WT_OUTPUT_ROOT'] ?? 'out/walkthrough/run';

export default defineConfig({
  testDir: './tests/walkthrough',
  testMatch: process.env['WT_SELFTEST'] ? '**/*.selftest.ts' : '**/*.walkthrough.ts', // WT_SELFTEST=1 runs the harness self-test only
  outputDir: `${outputRoot}/_pw`,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 0, // one uninterrupted run; individual steps carry their own expectation timeouts
  reporter: 'list',
  use: {
    baseURL: process.env['WT_UI_ORIGIN'] ?? 'http://localhost:3102',
    viewport: { width: 1280, height: 720 },
    video: { mode: 'on', size: { width: 1280, height: 720 } },
    screenshot: 'off',
    trace: 'off',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
