import { setRequestLocale } from "next-intl/server";
import type { CSSProperties } from "react";
import { redirect } from "@/i18n/navigation";
import { requireSeller } from "@/lib/auth/guard";
import { countSellerProducts } from "@/lib/repositories/products.repo";
import {
  listOrdersForSeller,
  countOrdersForSeller,
} from "@/lib/repositories/orders.repo";
import { sellerEarningsSummary } from "@/lib/repositories/seller-commissions.repo";
import { formatBDT } from "@/lib/money";
import { CtaButton } from "@/components/ui/cta-button";

export const dynamic = "force-dynamic";

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

  const [productCount, earnings, orderCount, recentOrders] = await Promise.all([
    countSellerProducts(sellerId),
    sellerEarningsSummary(sellerId),
    countOrdersForSeller(sellerId),
    listOrdersForSeller(sellerId),
  ]);

  const recent = recentOrders.slice(0, 5);

  const kpis = [
    { label: "Total products", value: String(productCount) },
    { label: "Available earnings", value: formatBDT(earnings.accruedMinor) },
    { label: "Paid out", value: formatBDT(earnings.paidMinor) },
    { label: "Orders", value: String(orderCount) },
  ];

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

      <div style={kpiGrid}>
        {kpis.map((k) => (
          <div key={k.label} style={kpiCard}>
            <span style={kpiLabel}>{k.label}</span>
            <strong style={kpiValue}>{k.value}</strong>
          </div>
        ))}
      </div>

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

const kpiGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
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
