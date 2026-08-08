import { setRequestLocale } from "next-intl/server";
import type { CSSProperties } from "react";
import { redirect, Link } from "@/i18n/navigation";
import { requireSeller } from "@/lib/auth/guard";
import { sellerProductStateCounts } from "@/lib/repositories/products.repo";
import {
  listOrdersForSeller,
  countOrdersForSeller,
} from "@/lib/repositories/orders.repo";
import {
  sellerEarningsSummary,
  sellerEarningsSeries,
} from "@/lib/repositories/seller-commissions.repo";
import { formatBDT } from "@/lib/money";
import { CtaButton } from "@/components/ui/cta-button";
import { SellerSalesChart } from "@/components/seller/seller-sales-chart";

export const dynamic = "force-dynamic";

/** Zero-fill the last 30 days so quiet days render as a flat baseline.
 * (Module-level helper: the page is a server component, but the React
 * Compiler's purity lint still applies to the component body itself.) */
function zeroFillSeries(series: { day: string; earningsMinor: number }[]): {
  days: { day: string; earningsMinor: number }[];
  last30Minor: number;
} {
  const byDay = new Map(series.map((s) => [s.day, s.earningsMinor]));
  const days: { day: string; earningsMinor: number }[] = [];
  const now = Date.now();
  let last30Minor = 0;
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    const v = byDay.get(key) ?? 0;
    last30Minor += v;
    days.push({ day: key, earningsMinor: v });
  }
  return { days, last30Minor };
}

export default async function SellerDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await requireSeller();
  if (!session) {
    redirect({ href: "/become-a-seller", locale: locale as never });
  }

  const sellerId = String(session!.seller._id);

  const [productStats, earnings, orderCount, recentOrders, series] =
    await Promise.all([
      sellerProductStateCounts(sellerId),
      sellerEarningsSummary(sellerId),
      countOrdersForSeller(sellerId),
      listOrdersForSeller(sellerId),
      sellerEarningsSeries(sellerId, 30),
    ]);

  const recent = recentOrders.slice(0, 5);
  const { days, last30Minor } = zeroFillSeries(series);

  const kpis = [
    { label: "Available earnings", value: formatBDT(earnings.accruedMinor) },
    { label: "Paid out", value: formatBDT(earnings.paidMinor) },
    { label: "Earnings (30 days)", value: formatBDT(last30Minor) },
    { label: "Orders", value: String(orderCount) },
    {
      label: "Products live",
      value: `${productStats.live}${productStats.total > productStats.live ? ` / ${productStats.total}` : ""}`,
    },
  ];

  const reviewCount = productStats.pendingReview + productStats.updatesInReview;

  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "var(--s-4)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <h1 style={pageTitle}>Dashboard</h1>
          <p style={subtle}>An overview of your store.</p>
        </div>
        <CtaButton href="/seller/products/new">Add product</CtaButton>
      </div>

      {reviewCount > 0 && (
        <p style={reviewNotice}>
          {productStats.pendingReview > 0 && (
            <>
              {productStats.pendingReview} new listing
              {productStats.pendingReview === 1 ? "" : "s"} awaiting
              review.{" "}
            </>
          )}
          {productStats.updatesInReview > 0 && (
            <>
              {productStats.updatesInReview} update
              {productStats.updatesInReview === 1 ? "" : "s"} in review (your
              live listings keep selling meanwhile).{" "}
            </>
          )}
          <Link
            href="/seller/products"
            style={{ color: "var(--color-brand-deep)", fontWeight: 600 }}
          >
            View products
          </Link>
        </p>
      )}

      <div style={kpiGrid}>
        {kpis.map((k) => (
          <div key={k.label} style={kpiCard}>
            <span style={kpiLabel}>{k.label}</span>
            <strong style={kpiValue}>{k.value}</strong>
          </div>
        ))}
      </div>

      <section style={panel}>
        <h2 style={panelTitle}>Earnings — last 30 days</h2>
        <SellerSalesChart data={days} />
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: "var(--s-5)",
          alignItems: "start",
        }}
      >
        <section style={panel}>
          <h2 style={panelTitle}>Recent orders</h2>
          {recent.length === 0 ? (
            <p style={subtle}>No orders yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 2 }}>
              {recent.map((order) => {
                const myItems = order.items.filter(
                  (it) => String(it.productSnapshot.sellerId) === sellerId,
                );
                const itemCount = myItems.reduce((sum, it) => sum + it.qty, 0);
                return (
                  <div key={String(order._id)} style={orderRow}>
                    <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                      <span style={orderNum}>{order.orderNumber}</span>
                      <span style={subtle}>
                        {new Date(order.createdAt).toLocaleDateString()} ·{" "}
                        {itemCount} item{itemCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    <span style={statusPill}>{order.status}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section style={panel}>
          <h2 style={panelTitle}>Low stock</h2>
          {productStats.lowStock.length === 0 ? (
            <p style={subtle}>All live products are sufficiently stocked.</p>
          ) : (
            <div style={{ display: "grid", gap: 2 }}>
              {productStats.lowStock.map((p) => (
                <div key={p.id} style={orderRow}>
                  <Link
                    href={`/seller/products/${p.id}`}
                    style={{
                      color: "var(--color-text-strong)",
                      fontSize: 14,
                      textDecoration: "none",
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.name}
                  </Link>
                  <span
                    style={{
                      ...statusPill,
                      background: p.stockQty === 0 ? "#fee2e2" : "#fef3c7",
                      color: p.stockQty === 0 ? "#991b1b" : "#92400e",
                    }}
                  >
                    {p.stockQty === 0 ? "Out of stock" : `${p.stockQty} left`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const pageTitle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "var(--fs-h3)",
  color: "var(--color-text-strong)",
};

const subtle: CSSProperties = {
  color: "var(--color-text-muted)",
  fontSize: "var(--fs-small)",
};

const reviewNotice: CSSProperties = {
  margin: 0,
  fontSize: "var(--fs-small)",
  color: "#075985",
  background: "#e0f2fe",
  border: "1px solid #bae6fd",
  borderRadius: "var(--r-sm)",
  padding: "10px 14px",
  lineHeight: 1.5,
};

const kpiGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: "var(--s-4)",
};

const kpiCard: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-lg)",
  background: "var(--color-surface)",
  padding: "var(--s-5)",
  display: "grid",
  gap: 8,
};

const kpiLabel: CSSProperties = {
  color: "var(--color-text-muted)",
  fontSize: "var(--fs-caption)",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const kpiValue: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "var(--fs-h4)",
  color: "var(--color-text-strong)",
};

const panel: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-lg)",
  background: "var(--color-surface)",
  padding: "var(--s-5)",
  display: "grid",
  gap: "var(--s-4)",
};

const panelTitle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "var(--fs-h5)",
  color: "var(--color-text-strong)",
};

const orderRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--s-3)",
  padding: "10px 0",
  borderBottom: "1px solid var(--color-border)",
};

const orderNum: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 13,
  color: "var(--color-text-strong)",
};

const statusPill: CSSProperties = {
  fontSize: "var(--fs-caption)",
  padding: "3px 10px",
  borderRadius: "var(--r-pill)",
  background: "var(--color-surface-2)",
  color: "var(--color-text-muted)",
  textTransform: "capitalize",
  whiteSpace: "nowrap",
};
