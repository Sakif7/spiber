import { getLocale } from "next-intl/server";
import { listProducts } from "@/lib/repositories/products.repo";
import { listCategories } from "@/lib/repositories/taxonomy.repo";
import { localize } from "@/lib/schemas/localized";
import { logger } from "@/lib/log";
import type { Locale } from "@/i18n/routing";
import {
  CapitalEquipmentView,
  type CatalogItem,
  type TopCat,
} from "./capital-equipment-view";

const TONES = ["teal", "orange", "slate"] as const;

/**
 * Homepage equipment showcase, now driven by LIVE Instruments products
 * (active only). Resolves each product's top-level category for the filter
 * tabs and renders an interactive client view. Empty (e.g. all-draft) catalogs
 * degrade to a tasteful "coming online" state.
 */
export async function CapitalEquipment() {
  const locale = (await getLocale()) as Locale;

  let items: CatalogItem[] = [];
  let tops: TopCat[] = [];
  try {
    const [res, cats] = await Promise.all([
      listProducts({
        storefront: "instruments",
        status: "active",
        pageSize: 24,
        sort: "newest",
      }),
      listCategories("instruments"),
    ]);
    const byId = new Map(cats.map((c) => [String(c._id), c]));
    const topOf = (catId?: string) => {
      let cur = catId ? byId.get(catId) : undefined;
      while (cur?.parentId) cur = byId.get(String(cur.parentId));
      return cur;
    };
    tops = cats
      .filter((c) => !c.parentId)
      .map((c) => ({ slug: c.slug, name: localize(c.name, locale) }));
    items = res.items.map((p, i) => {
      const leaf = byId.get(String(p.categoryId));
      const top = topOf(String(p.categoryId));
      return {
        name: localize(p.name, locale),
        slug: p.slug,
        image: p.images?.[0] ?? null,
        sku: p.sku,
        catLabel: leaf ? localize(leaf.name, locale) : "",
        topSlug: top?.slug ?? "",
        tone: TONES[i % TONES.length],
        featured: !!p.featured,
      };
    });
  } catch (e) {
    logger.warn("home capital-equipment load failed", e);
  }

  return <CapitalEquipmentView items={items} tops={tops} />;
}
