import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listOrders } from "@/lib/repositories/orders.repo";
import { formatBDT } from "@/lib/money";
import type { OrderStatus } from "@/lib/schemas/order";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusFilterPills } from "@/components/admin/ui/status-filter";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

const STATUSES = [
  "all",
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
] as const;

const VALID_STATUSES = new Set<OrderStatus>([
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);

/** Public-facing store names for the storefront filter + column. */
const STOREFRONTS = ["all", "medtrade", "kart"] as const;
const STOREFRONT_PARAM: Record<string, "instruments" | "marketplace"> = {
  medtrade: "instruments",
  kart: "marketplace",
};

type Row = Awaited<ReturnType<typeof listOrders>>["items"][number];

export default async function AdminOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; store?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { status: rawStatus, store: rawStore } = await searchParams;
  const activeStatus =
    rawStatus && VALID_STATUSES.has(rawStatus as OrderStatus)
      ? (rawStatus as OrderStatus)
      : undefined;
  const activeStore = rawStore && STOREFRONT_PARAM[rawStore] ? rawStore : "all";

  let rows: Row[] = [];
  try {
    rows = (
      await listOrders({
        status: activeStatus,
        storefront: STOREFRONT_PARAM[activeStore],
        pageSize: 50,
      })
    ).items;
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "orderNumber",
      header: "Order #",
      cell: (order) => (
        <Link
          href={`/admin/orders/${String(order._id)}`}
          className="text-primary font-mono text-xs font-medium hover:underline"
        >
          {order.orderNumber}
        </Link>
      ),
    },
    {
      key: "date",
      header: "Date",
      cell: (order) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(order.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "store",
      header: "Store",
      cell: (order) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {order.storefront === "instruments" ? "Medtrade" : "Spiber Kart"}
        </span>
      ),
    },
    { key: "email", header: "Email", cell: (order) => order.email },
    {
      key: "status",
      header: "Status",
      cell: (order) => <StatusBadge>{order.status}</StatusBadge>,
    },
    {
      key: "payment",
      header: "Payment",
      cell: (order) => (
        <span className="text-muted-foreground capitalize">
          {order.payment?.status ?? "—"}
          {order.payment?.method && order.payment.method !== "offline"
            ? ` · ${order.payment.method}`
            : ""}
        </span>
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      className: "font-mono font-medium whitespace-nowrap",
      cell: (order) => formatBDT(order.totalMinor, "en"),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Orders"
        description="Medtrade and Spiber Kart orders — payment, fulfillment, and shipping."
        action={
          <a
            href="/api/admin/orders/export"
            download
            className="text-primary font-medium hover:underline"
          >
            Export CSV
          </a>
        }
      />
      <StatusFilterPills
        statuses={STATUSES}
        active={activeStatus ?? "all"}
        basePath="/admin/orders"
        keep={{ store: activeStore === "all" ? undefined : activeStore }}
        label="Status"
      />
      <StatusFilterPills
        statuses={STOREFRONTS}
        active={activeStore}
        basePath="/admin/orders"
        param="store"
        keep={{ status: activeStatus }}
        label="Store"
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(order) => String(order._id)}
        empty="No orders found."
        minWidth={720}
      />
    </div>
  );
}
