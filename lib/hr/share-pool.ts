/**
 * The share pool: the fixed number of shares the company issued, which every
 * director's holding is a fraction of.
 *
 * Pure and DB-free so the employee pages, the payroll page and the payslip can
 * all import it; the stored value lives in Settings under `SHARE_POOL_KEY`.
 *
 * `totalShares` is the denominator of every director's fraction — a holding of
 * 2,000 in a pool of 14,000 is one seventh of the month whether or not the
 * other six sevenths have been allocated yet. Unallocated shares' money stays
 * with the company, which is also how a reserve is kept: raise the pool. The
 * face value is for display (paid-up capital) and plays no part in the split.
 */

export const SHARE_POOL_KEY = "hr.sharePool";

export type SharePool = {
  totalShares: number;
  /** What one share was bought for, in poisha. Display only. */
  faceValueMinor?: number | null;
};

/** Until the pool is set there is nothing to divide by, and nobody is paid. */
export const EMPTY_POOL: SharePool = { totalShares: 0, faceValueMinor: null };

/** Paid-up capital: shares × face value, or null when no face value is set. */
export function paidUpCapitalMinor(pool: SharePool): number | null {
  return pool.faceValueMinor ? pool.totalShares * pool.faceValueMinor : null;
}

/** 2,000 of 14,000 → "14.29". */
export function holdingPercent(shares: number, totalShares: number): string {
  if (totalShares <= 0) return "0";
  const pct = (shares / totalShares) * 100;
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(2).replace(/0$/, "");
}
