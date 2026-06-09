import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { siteConfig, publicRoutes } from "@/lib/site-config";
import { listProducts } from "@/lib/repositories/products.repo";
import { listCategories } from "@/lib/repositories/taxonomy.repo";
import { listCourses } from "@/lib/repositories/courses.repo";
import { listSoftwareProducts } from "@/lib/repositories/software.repo";
import { listVisiblePostsForFeed } from "@/lib/repositories/blog.repo";
import { listVisibleAlbumsForFeed } from "@/lib/repositories/gallery.repo";
import { listVisibleEventsForFeed } from "@/lib/repositories/events.repo";
import { listVisibleJobsForFeed } from "@/lib/repositories/career.repo";

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

  // Active products per storefront (best-effort; sitemap builds if DB is down).
  try {
    const [instruments, marketplace, mpCategories] = await Promise.all([
      listProducts({
        storefront: "instruments",
        status: "active",
        pageSize: 60,
      }),
      listProducts({
        storefront: "marketplace",
        status: "active",
        pageSize: 60,
      }),
      listCategories("marketplace"),
    ]);
    for (const p of instruments.items) {
      const route = `/medtrade/product/${p.slug}`;
      entries.push({
        url: urlFor(route, routing.defaultLocale),
        alternates: { languages: languagesFor(route) },
      });
    }
    for (const p of marketplace.items) {
      const route = `/marketplace/product/${p.slug}`;
      entries.push({
        url: urlFor(route, routing.defaultLocale),
        alternates: { languages: languagesFor(route) },
      });
    }
    for (const c of mpCategories) {
      const route = `/marketplace/category/${c.slug}`;
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
      const route = `/digihealth/product/${s.slug}`;
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

  // Company section: published gallery albums, events, and open job postings.
  try {
    const [albums, events, jobs] = await Promise.all([
      listVisibleAlbumsForFeed(100),
      listVisibleEventsForFeed(100),
      listVisibleJobsForFeed(100),
    ]);
    const pushAll = (items: { slug: string }[], base: string) => {
      for (const it of items) {
        const route = `${base}/${it.slug}`;
        entries.push({
          url: urlFor(route, routing.defaultLocale),
          alternates: { languages: languagesFor(route) },
        });
      }
    };
    pushAll(albums, "/company/gallery");
    pushAll(events, "/company/events");
    pushAll(jobs, "/company/career");
  } catch {
    // DB unavailable — skip company entries.
  }

  return entries;
}
