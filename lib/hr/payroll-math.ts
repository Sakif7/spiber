/**
 * Payroll arithmetic, kept pure so the rules are testable on their own.
 */

/**
 * A director's share of a month's revenue.
 *
 * Shares are independent percentages of the same figure, not slices of one pot,
 * so they are each rounded on their own and are NOT expected to add up to the
 * revenue. Rounding is to the nearest poisha, the currency's smallest unit.
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
