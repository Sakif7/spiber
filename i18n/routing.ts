import { defineRouting } from "next-intl/routing";

/**
 * Single source of truth for supported locales and routing behaviour.
 * English is the default and fallback; Bangla is fully supported.
 * `localePrefix: "always"` keeps every public URL locale-prefixed (/en, /bn).
 */
export const routing = defineRouting({
  locales: ["en", "bn"],
  defaultLocale: "en",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
