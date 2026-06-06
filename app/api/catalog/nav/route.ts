import { ok } from "@/lib/http/respond";
import { listCategoryTree, listBrands } from "@/lib/repositories/taxonomy.repo";
import { localize } from "@/lib/schemas/localized";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

/**
 * Lightweight catalog nav for the header mega-menu cascade: the Instruments
 * category TREE (top-level categories each carrying their subcategories) + all
 * brands, localized. The drawer cascades top category → subcategory → product;
 * brands cascade straight to products. Public read.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const locale: Locale = sp.get("locale") === "bn" ? "bn" : "en";
  try {
    const [tree, brands] = await Promise.all([
      listCategoryTree("instruments"),
      listBrands(),
    ]);
    return ok({
      categories: tree.map((c) => ({
        id: String(c._id),
        slug: c.slug,
        name: localize(c.name, locale),
        children: c.children.map((ch) => ({
          id: String(ch._id),
          slug: ch.slug,
          name: localize(ch.name, locale),
        })),
      })),
      brands: brands.map((b) => ({
        id: String(b._id),
        name: localize(b.name, locale),
      })),
    });
  } catch {
    return ok({ categories: [], brands: [] });
  }
}
