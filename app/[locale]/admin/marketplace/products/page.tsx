import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CtaButton } from "@/components/ui/cta-button";
import { listProducts } from "@/lib/repositories/products.repo";
import { formatBDT } from "@/lib/money";
import { localize } from "@/lib/schemas/localized";

export const dynamic = "force-dynamic";

export default async function AdminMarketplaceProductsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let items: Awaited<ReturnType<typeof listProducts>>["items"] = [];
  try {
    items = (await listProducts({ storefront: "marketplace", pageSize: 60 }))
      .items;
  } catch {
    items = [];
  }

  const th: React.CSSProperties = {
    textAlign: "left",
    padding: "var(--s-3) var(--s-4)",
    fontSize: "var(--fs-sm)",
    fontWeight: 600,
    color: "var(--color-text-muted)",
    borderBottom: "1px solid var(--color-border)",
    whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
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
          Marketplace products
        </h1>
        <CtaButton href="/admin/marketplace/products/new" variant="primary">
          New product
        </CtaButton>
      </header>

      {items.length === 0 ? (
        <div
          style={{
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            borderRadius: "var(--r-lg)",
            padding: "var(--s-8)",
            textAlign: "center",
            color: "var(--color-text-muted)",
          }}
        >
          No marketplace products yet.
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
                minWidth: "680px",
              }}
            >
              <thead>
                <tr>
                  <th style={th}>Name</th>
                  <th style={th}>SKU</th>
                  <th style={{ ...th, textAlign: "right" }}>Price</th>
                  <th style={{ ...th, textAlign: "right" }}>Stock</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => {
                  const hasVariants = (p.variants?.length ?? 0) > 0;
                  const stock = hasVariants
                    ? p.variants.reduce((s, v) => s + v.stockQty, 0)
                    : p.stockQty;
                  return (
                    <tr key={String(p._id)}>
                      <td style={td}>
                        <Link
                          href={`/admin/marketplace/products/${String(p._id)}`}
                          style={{
                            color: "var(--color-brand-deep)",
                            fontWeight: 600,
                            textDecoration: "none",
                          }}
                        >
                          {localize(p.name, "en") || "(untitled)"}
                        </Link>
                        {p.featured && (
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 10,
                              color: "var(--color-secondary-deep)",
                              fontWeight: 700,
                            }}
                          >
                            ★ FEATURED
                          </span>
                        )}
                      </td>
                      <td
                        style={{
                          ...td,
                          fontFamily: "var(--font-mono)",
                          color: "var(--color-text-muted)",
                        }}
                      >
                        {p.sku}
                      </td>
                      <td style={{ ...td, textAlign: "right" }}>
                        {hasVariants
                          ? "Varies"
                          : p.priceMinor != null
                            ? formatBDT(p.priceMinor, "en")
                            : "—"}
                      </td>
                      <td style={{ ...td, textAlign: "right" }}>{stock}</td>
                      <td style={{ ...td, textTransform: "capitalize" }}>
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
