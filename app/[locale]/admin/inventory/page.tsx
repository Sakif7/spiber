import { setRequestLocale } from "next-intl/server";
import { listProducts } from "@/lib/repositories/products.repo";
import { localize } from "@/lib/schemas/localized";
import { StockAdjuster } from "@/components/admin/stock-adjuster";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string;
  name: string;
  sku: string;
  stockQty: number;
  lowStockThreshold: number;
  low: boolean;
};

export default async function InventoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: ProductRow[] = [];
  try {
    const result = await listProducts({ pageSize: 100 });
    rows = result.items.map((p) => {
      const stockQty = Number(p.stockQty ?? 0);
      const lowStockThreshold = Number(p.lowStockThreshold ?? 0);
      return {
        id: String(p._id),
        name: localize(p.name, "en"),
        sku: String(p.sku ?? ""),
        stockQty,
        lowStockThreshold,
        low: stockQty <= lowStockThreshold,
      };
    });
  } catch {
    rows = [];
  }

  const lowCount = rows.filter((r) => r.low).length;

  const columns: Column<ProductRow>[] = [
    {
      key: "name",
      header: "Name",
      cell: (r) => <span className="font-medium">{r.name}</span>,
    },
    {
      key: "sku",
      header: "SKU",
      cell: (r) => <span className="font-mono text-xs">{r.sku}</span>,
    },
    {
      key: "stock",
      header: "Stock",
      cell: (r) => (
        <span
          className={
            r.low
              ? "text-destructive font-mono font-semibold"
              : "font-mono font-semibold"
          }
        >
          {r.stockQty}
          {r.low ? (
            <span className="ml-1.5 text-sm font-medium">(low)</span>
          ) : null}
        </span>
      ),
    },
    {
      key: "adjust",
      header: "Adjust",
      cell: (r) => <StockAdjuster productId={r.id} />,
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Inventory"
        description={
          lowCount > 0
            ? `Low stock — ${lowCount} product${lowCount === 1 ? "" : "s"} at or below threshold.`
            : "Low stock — all products above their thresholds."
        }
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        empty="No products yet."
        minWidth={720}
      />
    </div>
  );
}
