import { ok } from "@/lib/http/respond";
import { listCategories, listBrands } from "@/lib/repositories/taxonomy.repo";
import { localize } from "@/lib/schemas/localized";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

/**
 * Lightweight catalog nav for the header mega-menu: top-level Instruments
 * categories + all brands, localized. Public read.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const locale: Locale = sp.get("locale") === "bn" ? "bn" : "en";
  try {
    const [cats, brands] = await Promise.all([
      listCategories("instruments"),
      listBrands(),
    ]);
    return ok({
      categories: cats
        .filter((c) => !c.parentId)
        .map((c) => ({
          id: String(c._id),
          slug: c.slug,
          name: localize(c.name, locale),
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
