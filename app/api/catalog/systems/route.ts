import { ok } from "@/lib/http/respond";
import { listSoftwareProducts } from "@/lib/repositories/software.repo";
import { localize } from "@/lib/schemas/localized";
import { asLocale } from "@/lib/i18n/intl-locale";

export const dynamic = "force-dynamic";

/** Active Spiber Digihealth (software) products for the header mega-menu. */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const locale = asLocale(sp.get("locale"));
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
