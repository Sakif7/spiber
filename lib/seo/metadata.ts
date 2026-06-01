import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { siteConfig } from "@/lib/site-config";

const path = (locale: string, p: string) => `/${locale}${p === "/" ? "" : p}`;

/** hreflang alternates for a path across all locales (+ canonical for one). */
export function alternatesFor(
  locale: Locale,
  p: string,
): Metadata["alternates"] {
  return {
    canonical: path(locale, p),
    languages: Object.fromEntries(routing.locales.map((l) => [l, path(l, p)])),
  };
}

/** Build per-page metadata with canonical, hreflang, and Open Graph. */
export function pageMetadata({
  locale,
  path: p,
  title,
  description,
}: {
  locale: Locale;
  path: string;
  title: string;
  description?: string;
}): Metadata {
  return {
    title,
    description,
    alternates: alternatesFor(locale, p),
    openGraph: {
      title,
      description,
      url: `${siteConfig.url}${path(locale, p)}`,
      siteName: siteConfig.brand,
      locale,
      type: "website",
    },
  };
}

/**
 * Page metadata sourced from a message-catalog namespace that exposes `title`
 * and `description` keys (used by hubs and simple marketing pages).
 */
export async function namespaceMetadata(
  locale: Locale,
  namespace: string,
  p: string,
): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace });
  return pageMetadata({
    locale,
    path: p,
    title: t("title"),
    description: t("description"),
  });
}
