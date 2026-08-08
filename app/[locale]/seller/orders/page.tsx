import { setRequestLocale } from "next-intl/server";
import type { CSSProperties } from "react";
import { redirect } from "@/i18n/navigation";
import { requireSeller } from "@/lib/auth/guard";
import { listOrdersForSeller } from "@/lib/repositories/orders.repo";
import { sellerCommissionsByOrderIds } from "@/lib/repositories/seller-commissions.repo";
import { formatBDT } from "@/lib/money";
import { localize } from "@/lib/schemas/localized";
import type { Locale } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default async function SellerOrdersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const loc = locale as Locale;

  const session = await requireSeller();
  if (!session) {
    redirect({ href: "/become-a-seller", locale: locale as never });
  }

  const sellerId = String(session!.seller._id);
  const orders = await listOrdersForSeller(sellerId);

  // Net earnings per order from the commission ledger (exists once paid).
  const commissions = await sellerCommissionsByOrderIds(
    sellerId,
    orders.map((o) => String(o._id)),
  ).catch(() => []);
  const commissionByOrder = new Map(
    commissions.map((c) => [String(c.orderId), c]),
  );

  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <div style={{ display: "grid", gap: 4 }}>
        <h1 style={pageTitle}>Orders</h1>
        <p style={subtle}>Orders that include your products.</p>
      </div>

      {orders.length === 0 ? (
        <div style={emptyBox}>
          <p style={{ color: "var(--color-text-strong)", fontWeight: 600 }}>
            No orders yet.
          </p>
          <p style={subtle}>
            Once customers buy your products, their orders will appear here.
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "var(--s-4)" }}>
          {orders.map((order) => {
            const myItems = order.items.filter(
              (it) => String(it.productSnapshot.sellerId) === sellerId,
            );
            const yourSales = myItems.reduce(
              (sum, it) => sum + it.lineTotalMinor,
              0,
            );
            return (
              <article key={String(order._id)} style={card}>
                <div style={cardHead}>
                  <div style={{ display: "grid", gap: 2 }}>
                    <span style={orderNum}>{order.orderNumber}</span>
                    <span style={subtle}>
                      {new Date(order.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <span style={statusPill}>{order.status}</span>
                </div>

                <div style={{ display: "grid", gap: 8 }}>
                  {myItems.map((it, i) => (
                    <div key={i} style={itemRow}>
                      <span style={{ color: "var(--color-text)" }}>
                        {localize(it.productSnapshot.name, loc)}
                        <span style={{ color: "var(--color-text-muted)" }}>
                          {" "}
                          × {it.qty}
                        </span>
                      </span>
                      <span style={{ color: "var(--color-text-strong)" }}>
                        {formatBDT(it.lineTotalMinor, loc)}
                      </span>
                    </div>
                  ))}
                </div>

                <div style={salesRow}>
                  <span style={{ color: "var(--color-text-muted)" }}>
                    Your sales this order
                  </span>
                  <strong style={{ color: "var(--color-text-strong)" }}>
                    {formatBDT(yourSales, loc)}
                  </strong>
                </div>
                {(() => {
                  const c = commissionByOrder.get(String(order._id));
                  return (
                    <div style={{ ...salesRow, paddingTop: 4 }}>
                      <span style={{ color: "var(--color-text-muted)" }}>
                        Your earnings (after{" "}
                        {c
                          ? `${(c.commissionRateBp / 100).toFixed(c.commissionRateBp % 100 === 0 ? 0 : 2)}%`
                          : ""}{" "}
                        platform fee)
                      </span>
                      {c ? (
                        c.status === "void" ? (
                          <strong style={{ color: "var(--color-error)" }}>
                            Voided (order {order.status})
                          </strong>
                        ) : (
                          <strong style={{ color: "var(--color-brand-deep)" }}>
                            {formatBDT(c.sellerEarningsMinor, loc)}
                            {c.status === "paid" ? " · paid out" : ""}
                          </strong>
                        )
                      ) : (
                        <span style={{ color: "var(--color-text-muted)" }}>
                          Pending payment
                        </span>
                      )}
                    </div>
                  );
                })()}
              </article>
            );
          })}
        </div>
      )}
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

const emptyBox: CSSProperties = {
  border: "1px dashed var(--color-border)",
  borderRadius: "var(--r-lg)",
  background: "var(--color-surface)",
  padding: "var(--s-8)",
  display: "grid",
  gap: 8,
  justifyItems: "start",
};

const card: CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--r-lg)",
  background: "var(--color-surface)",
  padding: "var(--s-5)",
  display: "grid",
  gap: "var(--s-4)",
};

const cardHead: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--s-3)",
  borderBottom: "1px solid var(--color-border)",
  paddingBottom: "var(--s-3)",
};

const orderNum: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 14,
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

const itemRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--s-3)",
  fontSize: 14,
};

const salesRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "var(--s-3)",
  borderTop: "1px solid var(--color-border)",
  paddingTop: "var(--s-3)",
  fontSize: 15,
};
