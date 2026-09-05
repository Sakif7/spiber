import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { csvPreviewSchema } from "@/lib/schemas/inventory";
import { parseReceiveCsv } from "@/lib/inventory/csv";
import { resolveUnitsBySku } from "@/lib/repositories/inventory.repo";

/**
 * CSV preview: parse the upload and resolve each SKU to a stock unit so the
 * admin can review (unknown SKUs, seller-managed units, resulting balances)
 * before the matched lines are applied through `/api/admin/inventory/bulk`.
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const parsed = await parseJson(req, csvPreviewSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const result = parseReceiveCsv(parsed.data.text);
  const units = await resolveUnitsBySku(result.lines.map((l) => l.sku));
  const lines = result.lines.map((l) => {
    const unit = units[l.sku];
    return {
      line: l.line,
      sku: l.sku,
      qty: l.qty,
      reason: l.reason ?? null,
      unit: unit
        ? {
            key: unit.key,
            productId: unit.productId,
            variantId: unit.variantId,
            name: unit.name,
            variantLabel: unit.variantLabel,
            sku: unit.sku,
            storefront: unit.storefront,
            stock: unit.stock,
            tracked: unit.tracked,
            seller: Boolean(unit.sellerId),
          }
        : null,
      error: unit
        ? unit.stock + l.qty < 0
          ? `Would take the balance below zero (${unit.stock} on hand)`
          : null
        : "Unknown SKU",
    };
  });
  return ok({ lines, errors: result.errors, hadHeader: result.hadHeader });
}
