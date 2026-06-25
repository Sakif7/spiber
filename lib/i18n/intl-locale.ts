import { routing, type Locale } from "@/i18n/routing";

/**
 * Locale helpers shared across the app so a new UI locale only needs to be
 * added in ONE place (here + `i18n/routing.ts`), not in scattered
 * `locale === "bn" ? … : …` ternaries.
 */

/** BCP-47 tag for `Intl.*` formatters (dates, numbers, currency), per locale. */
const BCP47: Record<Locale, string> = {
  en: "en-US",
  bn: "bn-BD",
  ja: "ja-JP",
};

export function bcp47(locale: string | null | undefined): string {
  return BCP47[locale as Locale] ?? BCP47[routing.defaultLocale];
}

/** Narrow an arbitrary string to a supported `Locale`, defaulting to English. */
export function asLocale(value: string | null | undefined): Locale {
  return (routing.locales as readonly string[]).includes(value ?? "")
    ? (value as Locale)
    : routing.defaultLocale;
}

/**
 * Build a public pathname for a locale, honouring `localePrefix: "as-needed"`:
 * the default locale (English) is served at the bare path (no prefix), and
 * every other locale keeps its prefix. Single source of truth for canonical,
 * hreflang, sitemap, and JSON-LD URLs.
 *   localePath("en", "/contact") → "/contact"   localePath("bn", "/contact") → "/bn/contact"
 *   localePath("en", "/")        → "/"           localePath("ja", "/")        → "/ja"
 */
export function localePath(locale: string, pathname: string): string {
  const clean = pathname === "/" ? "" : pathname;
  return locale === routing.defaultLocale ? clean || "/" : `/${locale}${clean}`;
}
