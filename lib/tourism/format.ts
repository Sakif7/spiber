import { formatBDT } from "@/lib/money";
import { localize } from "@/lib/schemas/localized";
import type { Locale } from "@/i18n/routing";

type CostRange =
  | {
      bdtMinMinor?: number | null;
      bdtMaxMinor?: number | null;
      foreignLabel?: string;
      foreignNote?: { en: string; bn?: string };
    }
  | null
  | undefined;

/**
 * A patient-facing cost label: a BDT range with the clearly-LABELED foreign
 * estimate appended in parentheses (never mixed into the BDT figure). Returns
 * null when there's nothing to show, so callers render "Price on request".
 */
export function costRangeLabel(cr: CostRange, locale: Locale): string | null {
  if (!cr) return null;
  const parts: string[] = [];
  const { bdtMinMinor, bdtMaxMinor, foreignLabel } = cr;
  if (bdtMinMinor != null && bdtMaxMinor != null) {
    parts.push(
      `${formatBDT(bdtMinMinor, locale)} – ${formatBDT(bdtMaxMinor, locale)}`,
    );
  } else if (bdtMinMinor != null) {
    parts.push(`${formatBDT(bdtMinMinor, locale)}+`);
  } else if (bdtMaxMinor != null) {
    parts.push(formatBDT(bdtMaxMinor, locale));
  }
  if (foreignLabel) parts.push(`(${foreignLabel})`);
  const note = cr.foreignNote ? localize(cr.foreignNote, locale) : "";
  if (note) parts.push(`· ${note}`);
  return parts.length ? parts.join(" ") : null;
}
