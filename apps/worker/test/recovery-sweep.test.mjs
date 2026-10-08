import { test, expect } from 'vitest';
import { createRecoverySweep } from '../src/recovery-sweep.ts';

test('serializes concurrent sweeps and drains before shutdown', async () => {
  let release;
  let runs = 0;
  const gate = new Promise((resolve) => { release = resolve; });
  const errors = [];
  const sweep = createRecoverySweep(async () => { runs++; await gate; }, (e) => errors.push(e));
  const first = sweep.runOnce();
  const second = sweep.runOnce();
  expect(runs).toBe(1);
  expect(first).toBe(second);
  let drained = false;
  const draining = sweep.drain().then(() => { drained = true; });
  await Promise.resolve();
  expect(drained).toBe(false);
  await sweep.runOnce(); // Must not initiate new work after drain begins.
  expect(runs).toBe(1);
  release();
  await draining;
  expect(drained).toBe(true);
  expect(errors).toHaveLength(0);
});

test('reports sweep failure and remains stoppable', async () => {
  const failures = [];
  const sweep = createRecoverySweep(async () => { throw new Error('transient'); }, (error) => failures.push(error));
  await sweep.runOnce();
  await sweep.drain();
  expect(failures).toHaveLength(1);
});
