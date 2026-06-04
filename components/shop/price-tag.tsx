import { formatBDT } from "@/lib/money";
import type { Locale } from "@/i18n/routing";

/**
 * Renders an amount in poisha as locale-formatted BDT. When `minor` is null
 * (instruments "Price on request", or a not-yet-priced product), renders
 * `fallback` if provided, otherwise nothing. Server- and client-safe.
 */
export function PriceTag({
  minor,
  locale,
  style,
  fallback,
  prefix,
}: {
  minor: number | null | undefined;
  locale: Locale;
  style?: React.CSSProperties;
  fallback?: string;
  prefix?: string;
}) {
  if (minor == null) {
    return fallback ? <span style={style}>{fallback}</span> : null;
  }
  return (
    <span style={style}>
      {prefix ? `${prefix} ` : ""}
      {formatBDT(minor, locale)}
    </span>
  );
}
