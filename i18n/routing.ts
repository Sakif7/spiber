import { defineRouting } from "next-intl/routing";

/**
 * Single source of truth for supported locales and routing behaviour.
 * English is the default and fallback; Bangla and Japanese are fully supported.
 * `localePrefix: "always"` keeps every public URL locale-prefixed (/en, /bn, /ja).
 */
export const routing = defineRouting({
  locales: ["en", "bn", "ja"],
  defaultLocale: "en",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
