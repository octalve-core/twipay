/** Serialize periodic recovery and drain in-flight work before the Nest context closes. */
export function createRecoverySweep(run: () => Promise<void>, onError: (error: unknown) => void) {
  let active: Promise<void> | undefined;
  let stopping = false;
  return {
    runOnce(): Promise<void> {
      if (stopping) return Promise.resolve();
      if (active) return active;
      const task = (async () => {
        try { await run(); } catch (error) { onError(error); }
      })();
      active = task;
      void task.finally(() => { if (active === task) active = undefined; });
      return task;
    },
    async drain(): Promise<void> {
      stopping = true;
      await active;
    },
  };
}
