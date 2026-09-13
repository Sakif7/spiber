/**
 * Payroll arithmetic, kept pure so the rules are testable on their own.
 */

/**
 * What a month has to give the directors.
 *
 * The starting figure is the sales report's cash after AIT — goods sold less
 * what they cost, less what the orders cost to fulfil, less what was spent
 * winning them, less what the buyers kept back at source. Fixed salaries come
 * off next: they are a real bill the company pays before anyone takes a
 * dividend. What is left is split by shareholding; a month that comes out
 * negative distributes nothing rather than a debt.
 */
export function distributablePool(
  netCashMinor: number,
  salariesMinor: number,
): number {
  return Math.max(0, netCashMinor - salariesMinor);
}

/**
 * A director's slice of the pool.
 *
 * Proportional to shares held over the shares issued — NOT over the shares
 * currently allocated — so a holding of 2,000 in a pool of 14,000 is one
 * seventh whether or not the other six sevenths belong to anyone yet. The
 * money behind unallocated shares stays with the company. Rounded to the
 * nearest poisha, so slices need not add up to the pool exactly.
 */
export function shareOfPool(
  poolMinor: number,
  shares: number,
  totalShares: number,
): number {
  if (shares <= 0 || totalShares <= 0 || poolMinor <= 0) return 0;
  return Math.round((poolMinor * shares) / totalShares);
}

/**
 * Legacy: a director's share of a month's revenue under the percentage scheme.
 *
 * Kept so a month approved before shareholdings existed can still be read
 * back and reprinted; nothing new is computed with it.
 */
export function shareOfRevenue(revenueMinor: number, rateBp: number): number {
  if (rateBp <= 0 || revenueMinor <= 0) return 0;
  return Math.round((revenueMinor * rateBp) / 10000);
}

/** A rate in basis points as a percentage, for display: 1250 → "12.5". */
export function rateLabel(rateBp: number): string {
  const pct = rateBp / 100;
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/0$/, "");
}
