/**
 * Format ledger/API integer minor-unit strings without ever converting the
 * financial value through a JavaScript Number.  NGN has two minor units.
 * The API remains the authority for balances and transaction state.
 */
export function formatNgnMinorUnits(minorUnits: string): string {
  if (!/^-?(?:0|[1-9]\d*)$/.test(minorUnits)) {
    throw new TypeError("Invalid integer minor-unit amount");
  }
  const negative = minorUnits.startsWith("-");
  const absolute = BigInt(minorUnits);
  const value = absolute < 0n ? -absolute : absolute;
  const integer = value / 100n;
  const fraction = (value % 100n).toString().padStart(2, "0");
  const grouped = integer.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative && value !== 0n ? "-" : ""}₦${grouped}.${fraction}`;
}
