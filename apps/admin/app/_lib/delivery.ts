// Share of decided dispatches that were delivered. Decided means delivered, failed or bounced; queued and suppressed messages
// have no outcome yet, so they are left out. Returns null while there is nothing decided, so the page can say so instead of
// inventing a number.
export function deliveryRate(delivered: number, failed: number): string | null {
  const decided = delivered + failed;
  if (decided <= 0) return null;
  const percent = (delivered / decided) * 100;
  // Never round a miss up to a clean 100%.
  const shown = failed > 0 && percent > 99.9 ? 99.9 : Math.round(percent * 10) / 10;
  return `${shown.toFixed(1)}%`;
}
