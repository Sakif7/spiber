import { ok } from "@/lib/http/respond";
import { listProducts } from "@/lib/repositories/products.repo";
import { categoryWithDescendantIds } from "@/lib/repositories/taxonomy.repo";
import { localize } from "@/lib/schemas/localized";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

/**
 * Products for the header mega-menu browser, filtered by an Instruments
 * category (descendant-resolved so a top category returns its whole subtree) or
 * a brand. Minimal fields. Public read.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const locale: Locale = sp.get("locale") === "bn" ? "bn" : "en";
  const categoryId = sp.get("categoryId") || undefined;
  const brandId = sp.get("brandId") || undefined;
  if (!categoryId && !brandId) return ok({ products: [] });
  try {
    const categoryIds = categoryId
      ? await categoryWithDescendantIds(categoryId, "instruments")
      : undefined;
    const { items, total } = await listProducts({
      storefront: "instruments",
      status: "active",
      categoryIds,
      brandId,
      pageSize: 24,
      sort: "newest",
    });
    return ok({
      total,
      products: items.map((p) => ({
        slug: p.slug,
        name: localize(p.name, locale),
        image: p.images?.[0] ?? null,
      })),
    });
  } catch {
    return ok({ total: 0, products: [] });
  }
}
