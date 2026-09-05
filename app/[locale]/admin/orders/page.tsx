import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listOrders } from "@/lib/repositories/orders.repo";
import { formatBDT } from "@/lib/money";
import type { OrderStatus } from "@/lib/schemas/order";
import {
  parseListQuery,
  type ListConfig,
  type SearchParamsInput,
} from "@/lib/admin/list-params";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ListToolbar } from "@/components/admin/ui/list-toolbar";
import { Pagination } from "@/components/admin/ui/pagination";
import { RowActions } from "@/components/admin/ui/row-actions";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

const STATUSES: OrderStatus[] = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
];

/** Public-facing store names for the storefront filter + column. */
const STOREFRONT_PARAM: Record<string, "instruments" | "marketplace"> = {
  medtrade: "instruments",
  kart: "marketplace",
};

const LIST: ListConfig = {
  sortable: ["date", "number", "email", "status", "total"],
  defaultSort: "date",
  filters: ["status", "store", "from", "to"],
};

type Row = Awaited<ReturnType<typeof listOrders>>["items"][number];

export default async function AdminOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const status = STATUSES.includes(query.filters.status as OrderStatus)
    ? (query.filters.status as OrderStatus)
    : undefined;
  const storefront = STOREFRONT_PARAM[query.filters.store ?? ""];

  let rows: Row[] = [];
  let total = 0;
  let pages = 1;
  try {
    const res = await listOrders({
      status,
      storefront,
      search: query.q || undefined,
      sort: query.sort,
      dir: query.dir,
      from: query.filters.from,
      to: query.filters.to,
      page: query.page,
      pageSize: query.pageSize,
    });
    rows = res.items;
    total = res.total;
    pages = res.pages;
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "orderNumber",
      header: "Order #",
      sortKey: "number",
      sortDir: "asc",
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
      sortKey: "date",
      cell: (order) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(order.createdAt).toLocaleDateString("en-GB")}
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
    {
      key: "email",
      header: "Customer",
      sortKey: "email",
      sortDir: "asc",
      cell: (order) => order.email,
    },
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      sortDir: "asc",
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
      sortKey: "total",
      className: "font-mono font-medium whitespace-nowrap",
      cell: (order) => formatBDT(order.totalMinor, "en"),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      mobile: "actions",
      className: "w-10",
      cell: (order) => (
        <RowActions
          label={`Actions for ${order.orderNumber}`}
          actions={[
            {
              label: "View order",
              href: `/admin/orders/${String(order._id)}`,
              icon: "view",
            },
            {
              label: "Invoice",
              href: `/admin/orders/${String(order._id)}/invoice`,
              icon: "invoice",
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Orders"
        description="Medtrade and Spiber Kart orders — payment, fulfilment, and shipping."
        action={
          <a
            href="/api/admin/orders/export"
            download
            className="text-primary text-[13px] font-medium hover:underline"
          >
            Export CSV
          </a>
        }
      />

      <ListToolbar
        search={{ placeholder: "Search order # or customer email…" }}
        filters={[
          {
            param: "status",
            label: "Status",
            kind: "pills",
            options: STATUSES.map((s) => ({ value: s, label: s })),
          },
          {
            param: "store",
            label: "Store",
            kind: "pills",
            options: [
              { value: "medtrade", label: "Medtrade" },
              { value: "kart", label: "Spiber Kart" },
            ],
          },
        ]}
        dateRange
        sort={{
          options: [
            { value: "date", label: "Date" },
            { value: "total", label: "Total" },
            { value: "status", label: "Status", defaultDir: "asc" },
            { value: "number", label: "Order #", defaultDir: "asc" },
            { value: "email", label: "Customer", defaultDir: "asc" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        total={total}
        countLabel={`${total} order${total === 1 ? "" : "s"}`}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(order) => String(order._id)}
        sort={{ key: query.sort, dir: query.dir }}
        empty={
          query.q || status || storefront || query.filters.from
            ? "No orders match these filters."
            : "No orders yet."
        }
        emptyDescription={
          query.q || status || storefront || query.filters.from
            ? "Try clearing the search or a filter."
            : "Orders appear here as soon as a customer checks out on Medtrade or Spiber Kart."
        }
        minWidth={820}
      />

      <Pagination
        page={query.page}
        pages={pages}
        total={total}
        pageSize={query.pageSize}
        noun="orders"
      />
    </div>
  );
}
