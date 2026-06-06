import { ok } from "@/lib/http/respond";
import { listCategoryTree } from "@/lib/repositories/taxonomy.repo";
import { localize } from "@/lib/schemas/localized";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

/** Marketplace category tree (tops + children) for the header mega-menu. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const locale: Locale = sp.get("locale") === "bn" ? "bn" : "en";
  try {
    const tree = await listCategoryTree("marketplace");
    return ok({
      categories: tree.map((t) => ({
        id: String(t._id),
        slug: t.slug,
        name: localize(t.name, locale),
        icon: t.icon ?? null,
        children: (t.children ?? []).map((c) => ({
          id: String(c._id),
          slug: c.slug,
          name: localize(c.name, locale),
        })),
      })),
    });
  } catch {
    return ok({ categories: [] });
  }
}
