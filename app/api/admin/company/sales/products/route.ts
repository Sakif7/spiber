import { ok } from "@/lib/http/respond";
import { listStockUnits } from "@/lib/repositories/inventory.repo";
import { salesLineDetails } from "@/lib/repositories/sales.repo";
import { guardSales } from "../_guard";

export const dynamic = "force-dynamic";

/**
 * Product search for the order builder.
 *
 * Returns stock UNITS (a simple product, or one variant), each with what is
 * still available — so whoever is quoting can see immediately whether the
 * company can actually supply the quantity.
 */
export async function GET(req: Request) {
  const g = await guardSales("sales-search", 240);
  if (!g.ok) return g.res;

  const url = new URL(req.url);
  const search = url.searchParams.get("q")?.trim() ?? "";
  const page = await listStockUnits({
    search: search || undefined,
    status: "active",
    pageSize: 20,
    sort: "name",
    dir: "asc",
  });

  // The stock-unit view stops at `brandId`, so the printed Brand/Origin and
  // Specification columns have nothing to prefill from. Resolve them for the
  // page being returned — one extra query for at most 20 rows.
  const detail = await salesLineDetails(page.items.map((u) => u.productId));

  return ok({
    items: page.items.map((u) => {
      const d = detail.get(u.productId);
      return {
        key: u.key,
        productId: u.productId,
        variantId: u.variantId,
        name: u.name,
        variantLabel: u.variantLabel,
        sku: u.sku,
        priceMinor: u.priceMinor,
        onHand: u.stock,
        reserved: u.reserved,
        available: u.available,
        tracked: u.tracked,
        description: d?.description ?? u.name,
        specification: d?.specification ?? u.name,
        brandOrigin: d?.brandOrigin ?? "",
        // Separately too: an equipment line keeps the maker and the country
        // in fields of their own.
        brand: d?.brand ?? "",
        origin: d?.origin ?? "",
        costPriceMinor: d?.costPriceMinor ?? null,
      };
    }),
  });
}
