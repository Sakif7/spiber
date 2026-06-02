import { setRequestLocale } from "next-intl/server";
import { listProducts } from "@/lib/repositories/products.repo";
import { localize } from "@/lib/schemas/localized";
import { StockAdjuster } from "@/components/admin/stock-adjuster";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string;
  name: string;
  sku: string;
  stockQty: number;
  lowStockThreshold: number;
  low: boolean;
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 14px",
  fontSize: "var(--fs-small)",
  fontWeight: 600,
  color: "var(--color-text-muted)",
  borderBottom: "1px solid var(--color-border)",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 14px",
  fontSize: "var(--fs-body)",
  color: "var(--color-text)",
  borderBottom: "1px solid var(--color-border)",
  verticalAlign: "middle",
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

  return (
    <div style={{ display: "grid", gap: "var(--s-5)" }}>
      <header style={{ display: "grid", gap: "var(--s-2)" }}>
        <h1
          style={{
            fontSize: "var(--fs-h2)",
            fontFamily: "var(--font-display)",
            color: "var(--color-text-strong)",
            margin: 0,
          }}
        >
          Inventory
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: "var(--fs-small)",
            color:
              lowCount > 0 ? "var(--color-error)" : "var(--color-text-muted)",
          }}
        >
          {lowCount > 0
            ? `Low stock — ${lowCount} product${lowCount === 1 ? "" : "s"} at or below threshold.`
            : "Low stock — all products above their thresholds."}
        </p>
      </header>

      <div
        style={{
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          borderRadius: "var(--r-lg)",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>SKU</th>
              <th style={thStyle}>Stock</th>
              <th style={thStyle}>Adjust</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  style={{
                    ...tdStyle,
                    borderBottom: "none",
                    color: "var(--color-text-muted)",
                  }}
                  colSpan={4}
                >
                  No products yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ ...tdStyle, color: "var(--color-text-strong)" }}>
                    {r.name}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: "var(--font-mono)" }}>
                    {r.sku}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      fontFamily: "var(--font-mono)",
                      fontWeight: 600,
                      color: r.low ? "var(--color-error)" : "var(--color-text)",
                    }}
                  >
                    {r.stockQty}
                    {r.low ? (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: "var(--fs-small)",
                          fontWeight: 500,
                        }}
                      >
                        (low)
                      </span>
                    ) : null}
                  </td>
                  <td style={tdStyle}>
                    <StockAdjuster productId={r.id} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
