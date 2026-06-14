import { z } from "zod";
import type { Locale } from "@/i18n/routing";

/**
 * Multilingual content field. English is required and acts as the fallback;
 * Bangla and Japanese are optional. This is the canonical shape for all
 * localized content (products, courses, posts, …) per the data model.
 */
export const localizedSchema = z.object({
  en: z.string().min(1, "is required"),
  bn: z.string().optional(),
  ja: z.string().optional(),
});

export type Localized = z.infer<typeof localizedSchema>;

/** Resolve a localized value for a locale, falling back to English. */
export function localize(
  value: Localized | undefined | null,
  locale: Locale,
): string {
  if (!value) return "";
  if (locale === "ja" && value.ja) return value.ja;
  if (locale === "bn" && value.bn) return value.bn;
  return value.en;
}
