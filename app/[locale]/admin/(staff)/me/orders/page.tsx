import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { parseListQuery, type ListConfig } from "@/lib/admin/list-params";
import { myOrders } from "@/lib/services/me.service";
import { salesOrderStatusEnum } from "@/lib/schemas/sales-order";
import { formatBDT } from "@/lib/money";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ListToolbar } from "@/components/admin/ui/list-toolbar";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { Pagination } from "@/components/admin/ui/pagination";
import { StatusBadge, statusTone } from "@/components/admin/ui/status-badge";
import { employeeOrRedirect, cap, day } from "../_shared";

export const dynamic = "force-dynamic";

const LIST: ListConfig = { filters: ["status"] };

type Row = {
  id: string;
  number: string;
  invoiceNumber: string | null;
  organisation: string;
  status: string;
  payment: string;
  total: string;
  created: string;
};

/** Orders I recorded, or that belong to one of my leads. */
export default async function MyOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await employeeOrRedirect(locale, "/admin/me/orders");
  const query = parseListQuery(await searchParams, LIST);
  const page = await myOrders(session, {
    search: query.q,
    status: query.filters.status,
    page: query.page,
    pageSize: query.pageSize,
  });

  const rows: Row[] = page.items.map((o) => ({
    id: String(o._id),
    number: o.number,
    invoiceNumber: o.invoiceNumber ?? null,
    organisation: o.leadSnapshot.organisation,
    status: o.status,
    payment: o.payment.status,
    total: formatBDT(o.totalMinor, "en"),
    created: day(o.createdAt),
  }));

  const columns: Column<Row>[] = [
    {
      key: "number",
      header: "Order",
      cell: (r) => (
        <Link
          href={`/admin/me/orders/${r.id}`}
          className="text-primary font-mono text-xs font-medium hover:underline"
        >
          {r.number}
        </Link>
      ),
    },
    {
      key: "organisation",
      header: "Client",
      cell: (r) => <span>{r.organisation}</span>,
    },
    {
      key: "invoice",
      header: "Invoice",
      mobile: "meta",
      cell: (r) =>
        r.invoiceNumber ? (
          <span className="font-mono text-xs">{r.invoiceNumber}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      mobile: "meta",
      cell: (r) => (
        <StatusBadge tone={statusTone(r.status)}>{cap(r.status)}</StatusBadge>
      ),
    },
    {
      key: "payment",
      header: "Payment",
      mobile: "meta",
      cell: (r) => (
        <StatusBadge tone={r.payment === "paid" ? "success" : "warning"}>
          {cap(r.payment)}
        </StatusBadge>
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      cell: (r) => <span className="font-mono text-xs">{r.total}</span>,
    },
    {
      key: "created",
      header: "Recorded",
      mobile: "meta",
      cell: (r) => <span className="text-muted-foreground">{r.created}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="My sales orders"
        description="Orders you recorded, and orders on your leads."
      />
      <ListToolbar
        search={{ placeholder: "Search order, invoice, client…" }}
        filters={[
          {
            param: "status",
            label: "Status",
            options: salesOrderStatusEnum.options.map((s) => ({
              value: s,
              label: cap(s),
            })),
          },
        ]}
        total={page.total}
        countLabel={`${page.total} order${page.total === 1 ? "" : "s"}`}
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        empty="No sales orders on your leads yet."
        minWidth={760}
      />
      {page.pages > 1 && (
        <Pagination
          page={page.page}
          pages={page.pages}
          total={page.total}
          pageSize={page.pageSize}
          noun="orders"
        />
      )}
    </div>
  );
}
