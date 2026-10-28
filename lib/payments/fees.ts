import { dayOf } from "@/lib/hr/cycles";
import type { FeeMethod, FeeRateVersion } from "@/lib/schemas/payment";

/**
 * The gateway's fee on a payment. The company bears it (owner's decision,
 * 2026-10-28), so it is a cost in the sales report — worked out from the rates
 * the owner enters per method, and frozen on the payment when it settles.
 */

/** "bKash" / "MASTERCARD" / "Visa Card" → our fee-table key. */
export function feeMethodOf(method: string | null | undefined): FeeMethod {
  const m = (method ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (m.includes("bkash")) return "bkash";
  if (m.includes("nagad")) return "nagad";
  if (m.includes("rocket")) return "rocket";
  if (m.includes("upay")) return "upay";
  if (m.includes("visa")) return "visa";
  if (m.includes("master")) return "mastercard";
  return "other";
}

/** The set of rates in force on a Dhaka day: the newest one starting by then. */
export function rateVersionOn(
  versions: FeeRateVersion[],
  day: string,
): FeeRateVersion | null {
  let best: FeeRateVersion | null = null;
  for (const v of versions) {
    if (v.from <= day && (!best || v.from > best.from)) best = v;
  }
  return best;
}

/**
 * The fee for one payment, or null when no rates were in force that day — the
 * payment is then recorded with no fee, and the payments page says so.
 */
export function feeFor(
  amountMinor: number,
  method: string | null | undefined,
  at: Date,
  versions: FeeRateVersion[],
): { feeMinor: number; rateBp: number } | null {
  const version = rateVersionOn(versions, dayOf(at));
  if (!version) return null;
  const rateBp = version.rates[feeMethodOf(method)];
  return { feeMinor: Math.round((amountMinor * rateBp) / 10_000), rateBp };
}
