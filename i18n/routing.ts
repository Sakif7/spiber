import { defineRouting } from "next-intl/routing";

/**
 * Single source of truth for supported locales and routing behaviour.
 * English is the default and fallback; Bangla and Japanese are fully supported.
 *
 * `localePrefix: "as-needed"` serves the default locale (English) at bare,
 * un-prefixed paths (`/`, `/contact`, `/kart`) — these are real 200
 * pages and their own canonical — while Bangla/Japanese keep their prefix
 * (`/bn/…`, `/ja/…`). `/en/…` permanently redirects to the bare path. This
 * avoids the duplicate-content / wrong-canonical problem Google hits when the
 * canonical English page is only reachable via a redirect.
 */
export const routing = defineRouting({
  locales: ["en", "bn", "ja"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
