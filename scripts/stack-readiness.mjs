/** Only successful HTTP responses establish readiness; error pages are not healthy services. */
export function isReadyStatus(status) {
  return Number.isInteger(status) && status >= 200 && status < 400;
}

export async function waitForTarget(target, { fetcher = fetch, verifyResponse = async () => true, timeoutMs = 90_000, intervalMs = 1_000, now = Date.now, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  const deadline = now() + timeoutMs;
  let last = 'NO_ATTEMPT';
  do {
    try {
      const response = await fetcher(target, { redirect: 'manual', signal: AbortSignal.timeout(Math.min(5_000, timeoutMs)) });
      if (isReadyStatus(response.status)) {
        if (await verifyResponse(response)) return;
        last = 'UNEXPECTED_SERVICE_IDENTITY';
      } else last = `HTTP ${response.status}`;
    } catch (error) { last = error instanceof Error ? error.message : String(error); }
    if (now() >= deadline) break;
    await sleep(Math.min(intervalMs, Math.max(0, deadline - now())));
  } while (now() < deadline);
  throw new Error(`STACK_TARGET_UNAVAILABLE ${target}: ${last}`);
}

/** Vite's built HTML must contain the actual React root and the approved TwiPay title.
 * A healthy Next.js reference app must never qualify the ErhaPay-derived UI. */
export function isErhaPayCustomerShell(html) {
  return typeof html === 'string' && /<div\s+id=["']root["']\s*>/i.test(html) &&
    /<title>\s*TwiPay\s*<\/title>/i.test(html);
}
