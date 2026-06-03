import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { siteConfig, publicRoutes } from "@/lib/site-config";
import { listProducts } from "@/lib/repositories/products.repo";
import { listCourses } from "@/lib/repositories/courses.repo";
import { listSoftwareProducts } from "@/lib/repositories/software.repo";
import { listVisiblePostsForFeed } from "@/lib/repositories/blog.repo";

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

  // Published courses.
  try {
    const { items } = await listCourses({ status: "published", pageSize: 100 });
    for (const c of items) {
      const route = `/academy/course/${c.slug}`;
      entries.push({
        url: urlFor(route, routing.defaultLocale),
        alternates: { languages: languagesFor(route) },
      });
    }
  } catch {
    // DB unavailable — skip course entries.
  }

  // Active software products.
  try {
    const { items } = await listSoftwareProducts({
      status: "active",
      pageSize: 60,
    });
    for (const s of items) {
      const route = `/systems/product/${s.slug}`;
      entries.push({
        url: urlFor(route, routing.defaultLocale),
        alternates: { languages: languagesFor(route) },
      });
    }
  } catch {
    // DB unavailable — skip software entries.
  }

  // Published blog posts.
  try {
    const posts = await listVisiblePostsForFeed(100);
    for (const p of posts) {
      const route = `/blog/${p.slug}`;
      entries.push({
        url: urlFor(route, routing.defaultLocale),
        alternates: { languages: languagesFor(route) },
      });
    }
  } catch {
    // DB unavailable — skip blog entries.
  }

  return entries;
}
