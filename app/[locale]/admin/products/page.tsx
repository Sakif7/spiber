import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CtaButton } from "@/components/ui/cta-button";
import { listProducts } from "@/lib/repositories/products.repo";
import { formatBDT } from "@/lib/money";
import { localize } from "@/lib/schemas/localized";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string;
  name: string;
  sku: string;
  priceMinor: number;
  stockQty: number;
  lowStockThreshold: number;
  status: string;
};

export default async function AdminProductsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: ProductRow[] = [];
  try {
    const { items } = await listProducts({ pageSize: 60 });
    rows = items.map((p) => ({
      id: String(p._id),
      name: localize(p.name, "en"),
      sku: p.sku,
      priceMinor: p.priceMinor,
      stockQty: p.stockQty,
      lowStockThreshold: p.lowStockThreshold,
      status: p.status,
    }));
  } catch {
    rows = [];
  }

  const thStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "var(--s-3) var(--s-4)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--color-text-muted)",
    borderBottom: "1px solid var(--color-border)",
    whiteSpace: "nowrap",
  };

  const tdStyle: React.CSSProperties = {
    padding: "var(--s-3) var(--s-4)",
    fontSize: "var(--fs-sm)",
    color: "var(--color-text)",
    borderBottom: "1px solid var(--color-border)",
    verticalAlign: "middle",
  };

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--s-6)" }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--s-4)",
          flexWrap: "wrap",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-2xl)",
            fontWeight: 700,
            color: "var(--color-text-strong)",
            margin: 0,
          }}
        >
          Products
        </h1>
        <CtaButton href="/admin/products/new" variant="primary">
          New product
        </CtaButton>
      </header>

      {rows.length === 0 ? (
        <div
          style={{
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            borderRadius: "var(--r-lg)",
            padding: "var(--s-8)",
            textAlign: "center",
            color: "var(--color-text-muted)",
            fontSize: "var(--fs-base)",
          }}
        >
          No products yet.
        </div>
      ) : (
        <div
          style={{
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "640px",
              }}
            >
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>SKU</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Price</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Stock</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const low = p.stockQty <= p.lowStockThreshold;
                  return (
                    <tr key={p.id}>
                      <td style={tdStyle}>
                        <Link
                          href={`/admin/products/${p.id}`}
                          style={{
                            color: "var(--color-brand-deep)",
                            fontWeight: 600,
                            textDecoration: "none",
                          }}
                        >
                          {p.name || "(untitled)"}
                        </Link>
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          fontFamily: "var(--font-mono)",
                          color: "var(--color-text-muted)",
                        }}
                      >
                        {p.sku}
                      </td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>
                        {formatBDT(p.priceMinor, "en")}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "right",
                          fontWeight: low ? 700 : 400,
                          color: low
                            ? "var(--color-error)"
                            : "var(--color-text)",
                        }}
                      >
                        {p.stockQty}
                      </td>
                      <td style={{ ...tdStyle, textTransform: "capitalize" }}>
                        {p.status}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
