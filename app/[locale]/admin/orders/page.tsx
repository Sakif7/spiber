import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listOrders } from "@/lib/repositories/orders.repo";
import { formatBDT } from "@/lib/money";
import type { OrderStatus } from "@/lib/schemas/order";

export const dynamic = "force-dynamic";

const STATUS_FILTERS: Array<{ key: "all" | OrderStatus; label: string }> = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "paid", label: "Paid" },
  { key: "processing", label: "Processing" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
  { key: "refunded", label: "Refunded" },
];

const VALID_STATUSES = new Set<OrderStatus>([
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);

const STATUS_COLOR: Record<string, string> = {
  pending: "var(--color-text-muted)",
  paid: "var(--color-success)",
  processing: "var(--color-brand)",
  shipped: "var(--color-brand-deep)",
  delivered: "var(--color-success)",
  cancelled: "var(--color-error)",
  refunded: "var(--color-error)",
};

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

export default async function AdminOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { status: rawStatus } = await searchParams;
  const activeStatus =
    rawStatus && VALID_STATUSES.has(rawStatus as OrderStatus)
      ? (rawStatus as OrderStatus)
      : undefined;

  let items: Awaited<ReturnType<typeof listOrders>>["items"] = [];
  try {
    const result = await listOrders({ status: activeStatus, pageSize: 50 });
    items = result.items;
  } catch {
    items = [];
  }

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--s-5)" }}
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
          Orders
        </h1>
        <a
          href="/api/admin/orders/export"
          download
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--s-2)",
            padding: "var(--s-2) var(--s-4)",
            fontSize: "var(--fs-sm)",
            fontWeight: 600,
            color: "var(--color-brand-deep)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--r-sm)",
            background: "var(--color-surface)",
            textDecoration: "none",
          }}
        >
          Export CSV
        </a>
      </header>

      <nav
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--s-2)",
        }}
      >
        {STATUS_FILTERS.map(({ key, label }) => {
          const isActive =
            key === "all" ? activeStatus === undefined : activeStatus === key;
          return (
            <Link
              key={key}
              href={
                key === "all" ? "/admin/orders" : `/admin/orders?status=${key}`
              }
              style={{
                padding: "var(--s-1) var(--s-3)",
                fontSize: "var(--fs-sm)",
                fontWeight: 600,
                borderRadius: "var(--r-sm)",
                textDecoration: "none",
                border: "1px solid var(--color-border)",
                background: isActive
                  ? "var(--color-brand)"
                  : "var(--color-surface)",
                color: isActive ? "#fff" : "var(--color-text-muted)",
              }}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      <div
        style={{
          border: "1px solid var(--color-border)",
          borderRadius: "var(--r-lg)",
          background: "var(--color-surface)",
          overflow: "hidden",
        }}
      >
        {items.length === 0 ? (
          <div
            style={{
              padding: "var(--s-8) var(--s-4)",
              textAlign: "center",
              color: "var(--color-text-muted)",
              fontSize: "var(--fs-sm)",
            }}
          >
            No orders found.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "720px",
              }}
            >
              <thead>
                <tr>
                  <th style={thStyle}>Order #</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Payment</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((order) => {
                  const id = String(order._id);
                  return (
                    <tr key={id}>
                      <td style={tdStyle}>
                        <Link
                          href={`/admin/orders/${id}`}
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontWeight: 600,
                            color: "var(--color-brand-deep)",
                            textDecoration: "none",
                          }}
                        >
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                        {new Date(order.createdAt).toLocaleDateString()}
                      </td>
                      <td style={tdStyle}>{order.email}</td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            fontWeight: 600,
                            color:
                              STATUS_COLOR[order.status] ?? "var(--color-text)",
                          }}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          color: "var(--color-text-muted)",
                        }}
                      >
                        {order.payment?.status ?? "—"}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          textAlign: "right",
                          fontFamily: "var(--font-mono)",
                          fontWeight: 600,
                          color: "var(--color-text-strong)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatBDT(order.totalMinor, "en")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
