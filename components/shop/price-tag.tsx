import { formatBDT } from "@/lib/money";
import type { Locale } from "@/i18n/routing";

/** Renders an amount in poisha as locale-formatted BDT. Server- and client-safe. */
export function PriceTag({
  minor,
  locale,
  style,
}: {
  minor: number;
  locale: Locale;
  style?: React.CSSProperties;
}) {
  return <span style={style}>{formatBDT(minor, locale)}</span>;
}
