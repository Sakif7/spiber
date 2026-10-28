import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { Plus } from "lucide-react";
import { parseListQuery, type ListConfig } from "@/lib/admin/list-params";
import { listSalesOrders } from "@/lib/repositories/sales.repo";
import {
  salesOrderStatusEnum,
  salesOrderKindEnum,
  SALES_ORDER_STATUS_LABEL,
} from "@/lib/schemas/sales-order";
import { orderKindOf, SALES_ORDER_KIND_LABEL } from "@/lib/sales/equipment";
import { formatBDT } from "@/lib/money";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ListToolbar } from "@/components/admin/ui/list-toolbar";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { Pagination } from "@/components/admin/ui/pagination";
import { StatusBadge, statusTone } from "@/components/admin/ui/status-badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const LIST: ListConfig = {
  sortable: ["date", "number", "organisation", "status", "total"],
  defaultSort: "date",
  filters: ["status", "payment", "kind", "from", "to"],
};

type Row = {
  id: string;
  number: string;
  organisation: string;
  invoiceNumber: string | null;
  kind: string;
  status: string;
  payment: string;
  total: string;
  createdAt: string;
};

export default async function SalesOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Here too, not only in the layout: Next ships a page's payload even when
  // its layout shows the refusal instead.
  if (!(await requireSuperAdmin())) return null;
  const query = parseListQuery(await searchParams, LIST);

  const page = await listSalesOrders({
    search: query.q,
    status: query.filters.status,
    payment: query.filters.payment,
    kind: query.filters.kind,
    from: query.filters.from,
    to: query.filters.to,
    sort: query.sort,
    dir: query.dir,
    page: query.page,
    pageSize: query.pageSize,
  }).catch(() => null);

  const rows: Row[] = (page?.items ?? []).map((o) => ({
    id: String(o._id),
    number: o.number,
    organisation: o.leadSnapshot.organisation,
    invoiceNumber: o.invoiceNumber ?? null,
    kind: SALES_ORDER_KIND_LABEL[orderKindOf(o)],
    status: o.status,
    payment: o.payment.status,
    total: formatBDT(o.totalMinor, "en"),
    createdAt: new Date(o.createdAt).toLocaleDateString(),
  }));

  const columns: Column<Row>[] = [
    {
      key: "number",
      header: "Order",
      sortKey: "number",
      cell: (r) => (
        <Link
          href={`/admin/company/sales/orders/${r.id}`}
          className="text-primary font-mono text-xs font-medium hover:underline"
        >
          {r.number}
        </Link>
      ),
    },
    {
      key: "organisation",
      header: "Client",
      sortKey: "organisation",
      mobile: "meta",
      cell: (r) => <span>{r.organisation}</span>,
    },
    {
      key: "kind",
      header: "Type",
      mobile: "meta",
      cell: (r) => <span>{r.kind}</span>,
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
      sortKey: "status",
      mobile: "meta",
      cell: (r) => (
        <StatusBadge tone={statusTone(r.status)}>
          {SALES_ORDER_STATUS_LABEL[
            r.status as keyof typeof SALES_ORDER_STATUS_LABEL
          ] ?? r.status}
        </StatusBadge>
      ),
    },
    {
      key: "payment",
      header: "Payment",
      mobile: "meta",
      cell: (r) => (
        <StatusBadge tone={r.payment === "paid" ? "success" : "neutral"}>
          {r.payment === "paid" ? "Paid" : "Unpaid"}
        </StatusBadge>
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      sortKey: "total",
      mobile: "meta",
      cell: (r) => <span className="font-medium">{r.total}</span>,
    },
    {
      key: "date",
      header: "Raised",
      sortKey: "date",
      mobile: "meta",
      cell: (r) => <span className="text-muted-foreground">{r.createdAt}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Sales orders"
        description="Offline orders: quoted on a proposal, invoiced on terms, delivered by hand."
        action={
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/admin/company/sales/orders/new">
              <Plus className="size-4" />
              New order
            </Link>
          </Button>
        }
      />
      <ListToolbar
        search={{ placeholder: "Search order, invoice or client…" }}
        filters={[
          {
            param: "status",
            label: "Status",
            options: salesOrderStatusEnum.options.map((s) => ({
              value: s,
              label: SALES_ORDER_STATUS_LABEL[s],
            })),
          },
          {
            param: "payment",
            label: "Payment",
            options: [
              { value: "unpaid", label: "Unpaid" },
              { value: "paid", label: "Paid" },
            ],
          },
          {
            param: "kind",
            label: "Type",
            options: salesOrderKindEnum.options.map((k) => ({
              value: k,
              label: SALES_ORDER_KIND_LABEL[k],
            })),
          },
        ]}
        sort={{
          options: [
            { value: "date", label: "Date raised" },
            { value: "total", label: "Value" },
            { value: "organisation", label: "Client", defaultDir: "asc" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        dateRange
        total={page?.total ?? 0}
        countLabel={`${page?.total ?? 0} order${(page?.total ?? 0) === 1 ? "" : "s"}`}
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        empty="No sales orders yet."
        minWidth={900}
      />
      {page && page.pages > 1 && (
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
