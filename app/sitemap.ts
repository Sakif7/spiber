import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { siteConfig, publicRoutes } from "@/lib/site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url.replace(/\/$/, "");
  const urlFor = (route: string, locale: string) =>
    `${base}/${locale}${route === "/" ? "" : route}`;

  return publicRoutes.map((route) => ({
    url: urlFor(route, routing.defaultLocale),
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((locale) => [locale, urlFor(route, locale)]),
      ),
    },
  }));
}
