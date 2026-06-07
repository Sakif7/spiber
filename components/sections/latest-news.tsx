import { getLocale, getTranslations } from "next-intl/server";
import { listPublishedPosts } from "@/lib/repositories/blog.repo";
import { listBlogCategories } from "@/lib/repositories/blogTaxonomy.repo";
import { localize } from "@/lib/schemas/localized";
import { excerptFromHtml } from "@/lib/reading-time";
import { logger } from "@/lib/log";
import type { Locale } from "@/i18n/routing";
import { LatestNewsView, type NewsItem } from "./latest-news-view";

const TONES = ["teal", "orange", "slate"] as const;
const DISPLAY = 3;

/**
 * Homepage "Latest News", driven by LIVE published blog posts (publish-on-read
 * visible). Resolves each post's category for the kicker and formats date +
 * reading time per locale. An empty blog degrades to a "coming soon" state.
 */
export async function LatestNews() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("blog");

  let items: NewsItem[] = [];
  try {
    const [res, cats] = await Promise.all([
      listPublishedPosts({ pageSize: DISPLAY }),
      listBlogCategories(),
    ]);
    const catName = new Map(
      cats.map((c) => [String(c._id), localize(c.name, locale)]),
    );
    items = res.items.map((p, i) => {
      const date = p.publishedAt
        ? new Date(p.publishedAt).toLocaleDateString(
            locale === "bn" ? "bn-BD" : "en-GB",
            { year: "numeric", month: "short", day: "numeric" },
          )
        : "";
      const excerpt = p.excerpt
        ? localize(p.excerpt, locale)
        : excerptFromHtml(localize(p.body, locale));
      return {
        slug: p.slug,
        kicker: (p.categoryId && catName.get(String(p.categoryId))) || "",
        title: localize(p.title, locale),
        excerpt,
        date,
        readingTime: p.readingTimeMin
          ? t("readingTime", { min: p.readingTimeMin })
          : "",
        image: p.coverImage ?? null,
        tone: TONES[i % TONES.length],
      };
    });
  } catch (e) {
    logger.warn("home latest-news load failed", e);
  }

  return <LatestNewsView items={items} />;
}
