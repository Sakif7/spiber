import { requireAdmin } from "@/lib/auth/guard";
import { listMovementsForExport } from "@/lib/repositories/inventory.repo";
import {
  decorateMovements,
  MOVEMENT_TYPE_LABEL,
} from "@/lib/services/inventory-ledger.service";
import { movementTypeEnum, type MovementType } from "@/lib/schemas/inventory";

function cell(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const STORE: Record<string, string> = {
  instruments: "Medtrade",
  marketplace: "Spiber Kart",
};

/** CSV of the stock ledger, honouring the ledger page's filters (max 5000 rows). */
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return new Response("Forbidden", { status: 403 });
  const sp = new URL(req.url).searchParams;
  const typeRaw = sp.get("type") ?? "";
  const type = movementTypeEnum.options.includes(typeRaw as MovementType)
    ? (typeRaw as MovementType)
    : undefined;

  const items = await listMovementsForExport({
    search: sp.get("q") || undefined,
    productId: sp.get("product") || undefined,
    variantId: sp.get("variant") || undefined,
    type,
    source: sp.get("source") || undefined,
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
    sort: sp.get("sort") || undefined,
    dir: sp.get("dir") === "asc" ? "asc" : "desc",
  });
  const rows = await decorateMovements(items);

  const out: string[][] = [
    [
      "Date",
      "Product",
      "Variant",
      "SKU",
      "Store",
      "Type",
      "Change",
      "Balance after",
      "Source",
      "Reason",
      "Order",
      "Admin",
    ],
  ];
  for (const r of rows) {
    out.push([
      r.at,
      r.productName,
      r.variantLabel ?? "",
      r.sku,
      r.storefront ? (STORE[r.storefront] ?? r.storefront) : "",
      MOVEMENT_TYPE_LABEL[r.type] ?? r.type,
      String(r.qtyDelta),
      r.stockAfter == null ? "" : String(r.stockAfter),
      r.source,
      r.reason,
      r.orderNumber ?? "",
      r.adminName ?? "",
    ]);
  }
  const csv = out.map((r) => r.map(cell).join(",")).join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="stock-movements.csv"',
    },
  });
}
