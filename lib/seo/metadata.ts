import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { siteConfig } from "@/lib/site-config";
import { localePath } from "@/lib/i18n/intl-locale";

// Locale-aware path (bare for the default locale, prefixed for bn/ja).
const path = (locale: string, p: string) => localePath(locale, p);

/** Branded default social card (static, crawlable). See app/api/og + scripts/gen-og.mjs. */
export const DEFAULT_OG_IMAGE = `${siteConfig.url}/og.png`;

/** Make a possibly-relative image path absolute against the site origin. */
function absImage(u: string): string {
  if (/^https?:\/\//.test(u)) return u;
  return `${siteConfig.url}${u.startsWith("/") ? "" : "/"}${u}`;
}

/**
 * hreflang alternates for a path across all locales, plus a self canonical and
 * an `x-default` (the default locale). Canonical/alternates are query-free so
 * faceted + paginated variants all consolidate onto the clean page URL.
 */
export function alternatesFor(
  locale: Locale,
  p: string,
): Metadata["alternates"] {
  const languages: Record<string, string> = Object.fromEntries(
    routing.locales.map((l) => [l, path(l, p)]),
  );
  languages["x-default"] = path(routing.defaultLocale, p);
  return { canonical: path(locale, p), languages };
}

type PageMetaInput = {
  locale: Locale;
  path: string;
  title: string;
  description?: string;
  noindex?: boolean;
  /** Per-entity social image; falls back to the site's default OG card. */
  image?: string;
  /** Multiple social images (first is primary). */
  images?: string[];
  /** Open Graph type — defaults to "website". */
  type?: "website" | "article" | "profile";
};

/**
 * Build per-page metadata: canonical + hreflang (+ x-default), Open Graph, and
 * a Twitter summary-large-image card. When no entity image is supplied the site
 * falls back to the generated default OG card (`app/opengraph-image`), so every
 * page still has a valid social preview.
 */
export function pageMetadata({
  locale,
  path: p,
  title,
  description,
  noindex,
  image,
  images,
  type,
}: PageMetaInput): Metadata {
  // Per-entity image(s) when given, else the branded default card — so every
  // page always has a valid og:image / twitter:image.
  const ogImages = (
    images?.length ? images : image ? [image] : [DEFAULT_OG_IMAGE]
  ).map(absImage);

  const openGraph: NonNullable<Metadata["openGraph"]> = {
    title,
    description,
    url: `${siteConfig.url}${path(locale, p)}`,
    siteName: siteConfig.brand,
    locale,
    type: type ?? "website",
    images: ogImages,
  };

  return {
    title,
    description,
    alternates: alternatesFor(locale, p),
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
    openGraph,
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImages,
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
