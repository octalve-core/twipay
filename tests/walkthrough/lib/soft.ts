// RECON ONLY. In soft mode (WT_SOFT=1) a failed step is recorded as a finding and the run carries on to the next step, so one
// pass shows many problems. The final run is strict: WT_FINAL=1 refuses soft mode, and only a strict run is a deliverable.
export interface Failure { stepName: string; message: string }

export const failures: Failure[] = [];

export function assertModeIsSane(): void {
  if (process.env['WT_FINAL'] === '1' && process.env['WT_SOFT'] === '1') throw new Error('WALKTHROUGH_RULE: the final run must be strict, soft mode is for recon');
}

export async function runStep(stepName: string, action: () => Promise<void>): Promise<boolean> {
  if (process.env['WT_SOFT'] !== '1') {
    await action();
    return true;
  }
  try {
    await action();
    return true;
  } catch (error) {
    failures.push({ stepName, message: String(error).split('\n').slice(0, 6).join('\n') });
    return false;
  }
}

// Recon convenience: remember the people and authenticator secrets of a soft run so later chapters can be re-run without
// repeating the sign-ups. Never used by the strict final run (which starts from an empty database).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

export function loadState(path: string): { people: Record<string, unknown>; secrets: Record<string, string> } | undefined {
  if (process.env['WT_SOFT'] !== '1' || !existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function saveState(path: string, state: unknown): void {
  if (process.env['WT_SOFT'] === '1') writeFileSync(path, JSON.stringify(state));
}
