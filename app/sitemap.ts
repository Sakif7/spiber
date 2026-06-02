import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { siteConfig, publicRoutes } from "@/lib/site-config";
import { listProducts } from "@/lib/repositories/products.repo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url.replace(/\/$/, "");
  const urlFor = (route: string, locale: string) =>
    `${base}/${locale}${route === "/" ? "" : route}`;
  const languagesFor = (route: string) =>
    Object.fromEntries(routing.locales.map((l) => [l, urlFor(route, l)]));

  const entries: MetadataRoute.Sitemap = publicRoutes.map((route) => ({
    url: urlFor(route, routing.defaultLocale),
    alternates: { languages: languagesFor(route) },
  }));

  // Active products (best-effort; sitemap still builds if the DB is down).
  try {
    const { items } = await listProducts({ status: "active", pageSize: 60 });
    for (const p of items) {
      const route = `/instruments/product/${p.slug}`;
      entries.push({
        url: urlFor(route, routing.defaultLocale),
        alternates: { languages: languagesFor(route) },
      });
    }
  } catch {
    // DB unavailable — return static routes only.
  }

  return entries;
}
