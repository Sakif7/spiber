import { ok } from "@/lib/http/respond";
import { listSoftwareProducts } from "@/lib/repositories/software.repo";
import { localize } from "@/lib/schemas/localized";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

/** Active Spiber Digihealth (software) products for the header mega-menu. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const locale: Locale = sp.get("locale") === "bn" ? "bn" : "en";
  try {
    const { items, total } = await listSoftwareProducts({
      status: "active",
      pageSize: 24,
    });
    return ok({
      total,
      products: items.map((p) => ({
        slug: p.slug,
        name: localize(p.name, locale),
        image: p.screenshots?.[0] ?? null,
      })),
    });
  } catch {
    return ok({ total: 0, products: [] });
  }
}
