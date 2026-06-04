import { getTranslations } from "next-intl/server";
import { ok, fail } from "@/lib/http/respond";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { searchAll, type SearchResults } from "@/lib/services/search.service";
import { localize } from "@/lib/schemas/localized";
import { formatBDT } from "@/lib/money";
import { routing, type Locale } from "@/i18n/routing";
import type {
  SearchGroupDTO,
  SearchHit,
  SearchResponseDTO,
} from "@/lib/search/dto";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";

const PER_GROUP = 4;

function parseLocale(value: string | null): Locale {
  return routing.locales.includes(value as Locale)
    ? (value as Locale)
    : routing.defaultLocale;
}

export async function GET(req: Request) {
  if (!rateLimit(`search:${clientIp(req)}`, 40, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }

  const url = new URL(req.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  const locale = parseLocale(url.searchParams.get("locale"));

  const empty: SearchResponseDTO = { query, total: 0, groups: [] };
  if (query.length < 2) return ok(empty);

  try {
    const results = await searchAll(query, { perGroup: PER_GROUP });
    const t = await getTranslations({ locale, namespace: "search" });
    const labels: Labels = {
      free: t("free"),
      quote: t("quote"),
      from: (price) => t("from", { price }),
      readingTime: (min) => t("readingTime", { min }),
    };
    const groups = buildGroups(results, locale, labels);
    const total = groups.reduce((n, g) => n + g.total, 0);
    return ok({ query, total, groups } satisfies SearchResponseDTO);
  } catch (e) {
    logger.error("search api failed", e);
    return fail({ code: "search_failed" }, 500);
  }
}

// Pre-resolved, locale-aware labels — keeps the next-intl translator out of the
// pure mapping helpers (and out of their type signatures).
type Labels = {
  free: string;
  quote: string;
  from: (price: string) => string;
  readingTime: (min: number) => string;
};

function priceLabel(
  minor: number | null | undefined,
  locale: Locale,
  labels: Labels,
): string {
  if (minor == null) return labels.quote;
  if (minor === 0) return labels.free;
  return formatBDT(minor, locale);
}

/**
 * Marketplace products always carry a price: either a base `priceMinor` or, for
 * variant products (base null), per-variant prices — so show the lowest as
 * "From ৳X". Falls back to the quote label only if a product is somehow
 * price-less (shouldn't happen for an active marketplace product).
 */
function marketplacePriceLabel(
  base: number | null | undefined,
  variants: { priceMinorOverride?: number | null }[] | undefined,
  locale: Locale,
  labels: Labels,
): string {
  if (base != null) return priceLabel(base, locale, labels);
  const prices = (variants ?? [])
    .map((v) => v.priceMinorOverride)
    .filter((n): n is number => typeof n === "number");
  if (prices.length === 0) return labels.quote;
  const min = Math.min(...prices);
  return min === 0 ? labels.free : labels.from(formatBDT(min, locale));
}

function buildGroups(
  r: SearchResults,
  locale: Locale,
  labels: Labels,
): SearchGroupDTO[] {
  const groups: SearchGroupDTO[] = [];

  if (r.products.total > 0) {
    const hits: SearchHit[] = r.products.items.map((p) => ({
      id: String(p._id),
      group: "instruments",
      title: localize(p.name, locale),
      subtitle: priceLabel(p.priceMinor, locale, labels),
      href: `/instruments/product/${p.slug}`,
      image: p.images?.[0] ?? null,
    }));
    groups.push({ key: "instruments", total: r.products.total, hits });
  }

  if (r.marketplace.total > 0) {
    const hits: SearchHit[] = r.marketplace.items.map((p) => ({
      id: String(p._id),
      group: "marketplace",
      title: localize(p.name, locale),
      subtitle: marketplacePriceLabel(p.priceMinor, p.variants, locale, labels),
      href: `/marketplace/product/${p.slug}`,
      image: p.images?.[0] ?? null,
    }));
    groups.push({ key: "marketplace", total: r.marketplace.total, hits });
  }

  if (r.courses.total > 0) {
    const hits: SearchHit[] = r.courses.items.map((c) => ({
      id: String(c._id),
      group: "academy",
      title: localize(c.title, locale),
      subtitle: priceLabel(c.priceMinor, locale, labels),
      href: `/academy/course/${c.slug}`,
      image: c.thumbnail ?? null,
    }));
    groups.push({ key: "academy", total: r.courses.total, hits });
  }

  if (r.software.total > 0) {
    const hits: SearchHit[] = r.software.items.map((s) => ({
      id: String(s._id),
      group: "systems",
      title: localize(s.name, locale),
      subtitle:
        s.pricingModel === "quote"
          ? labels.quote
          : priceLabel(s.priceMinor, locale, labels),
      href: `/systems/product/${s.slug}`,
      image: s.screenshots?.[0] ?? null,
    }));
    groups.push({ key: "systems", total: r.software.total, hits });
  }

  if (r.posts.total > 0) {
    const dateFmt = new Intl.DateTimeFormat(
      locale === "bn" ? "bn-BD" : "en-US",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
      },
    );
    const hits: SearchHit[] = r.posts.items.map((post) => ({
      id: String(post._id),
      group: "blog",
      title: localize(post.title, locale),
      subtitle: post.readingTimeMin
        ? labels.readingTime(post.readingTimeMin)
        : post.publishedAt
          ? dateFmt.format(new Date(post.publishedAt))
          : undefined,
      href: `/blog/${post.slug}`,
      image: post.coverImage ?? null,
    }));
    groups.push({ key: "blog", total: r.posts.total, hits });
  }

  return groups;
}
