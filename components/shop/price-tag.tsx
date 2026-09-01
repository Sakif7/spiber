import { formatBDT } from "@/lib/money";
import type { Locale } from "@/i18n/routing";

/**
 * Renders an amount in poisha as locale-formatted BDT. When `minor` is null
 * (instruments "Price on request", or a not-yet-priced product), renders
 * `fallback` if provided, otherwise nothing. Server- and client-safe.
 *
 * When `floorMinor` is set BELOW `minor` the amount renders as a negotiable
 * range ("৳42,000 – ৳50,000") — a Medtrade product whose price is open to
 * negotiation down to the floor. An equal or higher floor renders a single
 * price, so a mis-entered floor can never look like a discount.
 */
export function PriceTag({
  minor,
  floorMinor,
  locale,
  style,
  fallback,
  prefix,
}: {
  minor: number | null | undefined;
  floorMinor?: number | null;
  locale: Locale;
  style?: React.CSSProperties;
  fallback?: string;
  prefix?: string;
}) {
  if (minor == null) {
    return fallback ? <span style={style}>{fallback}</span> : null;
  }
  const ranged = floorMinor != null && floorMinor < minor;
  return (
    <span style={style}>
      {prefix ? `${prefix} ` : ""}
      {ranged
        ? `${formatBDT(floorMinor, locale)} – ${formatBDT(minor, locale)}`
        : formatBDT(minor, locale)}
    </span>
  );
}
