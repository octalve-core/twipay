import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRecoverySweep } from '../src/recovery-sweep.ts';

test('serializes concurrent sweeps and drains before shutdown', async () => {
  let release;
  let runs = 0;
  const gate = new Promise((resolve) => { release = resolve; });
  const errors = [];
  const sweep = createRecoverySweep(async () => { runs++; await gate; }, (e) => errors.push(e));
  const first = sweep.runOnce();
  const second = sweep.runOnce();
  assert.equal(runs, 1);
  assert.equal(first, second);
  let drained = false;
  const draining = sweep.drain().then(() => { drained = true; });
  await Promise.resolve();
  assert.equal(drained, false);
  await sweep.runOnce(); // Must not initiate new work after drain begins.
  assert.equal(runs, 1);
  release();
  await draining;
  assert.equal(drained, true);
  assert.equal(errors.length, 0);
});

test('reports sweep failure and remains stoppable', async () => {
  const failures = [];
  const sweep = createRecoverySweep(async () => { throw new Error('transient'); }, (error) => failures.push(error));
  await sweep.runOnce();
  await sweep.drain();
  assert.equal(failures.length, 1);
});
