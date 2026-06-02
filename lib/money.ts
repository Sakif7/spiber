import type { Locale } from "@/i18n/routing";

/**
 * Money is stored everywhere as integer **poisha** (1 BDT = 100 poisha) to
 * avoid floating-point drift. Convert at the edges; never do float math on
 * prices. Display via `formatBDT`.
 */

export function toMinor(major: number): number {
  return Math.round(major * 100);
}

export function fromMinor(minor: number): number {
  return minor / 100;
}

/** Format poisha as Bangladeshi Taka (৳), locale-aware (Bangla numerals for bn). */
export function formatBDT(minor: number, locale: Locale = "en"): string {
  const major = minor / 100;
  const hasFraction = minor % 100 !== 0;
  return new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US", {
    style: "currency",
    currency: "BDT",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(major);
}
