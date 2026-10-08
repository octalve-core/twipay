/** Only successful HTTP responses establish readiness; error pages are not healthy services. */
export function isReadyStatus(status) {
  return Number.isInteger(status) && status >= 200 && status < 400;
}

export async function waitForTarget(target, { fetcher = fetch, timeoutMs = 90_000, intervalMs = 1_000, now = Date.now, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  const deadline = now() + timeoutMs;
  let last = 'NO_ATTEMPT';
  do {
    try {
      const response = await fetcher(target, { redirect: 'manual', signal: AbortSignal.timeout(Math.min(5_000, timeoutMs)) });
      if (isReadyStatus(response.status)) return;
      last = `HTTP ${response.status}`;
    } catch (error) { last = error instanceof Error ? error.message : String(error); }
    if (now() >= deadline) break;
    await sleep(Math.min(intervalMs, Math.max(0, deadline - now())));
  } while (now() < deadline);
  throw new Error(`STACK_TARGET_UNAVAILABLE ${target}: ${last}`);
}
