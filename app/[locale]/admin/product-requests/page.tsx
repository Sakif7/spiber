import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listProductRequests } from "@/lib/repositories/product-requests.repo";
import {
  productRequestStatusEnum,
  type ProductRequestStatus,
} from "@/lib/schemas/product-request";
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

const STATUSES = productRequestStatusEnum.options;

const LIST: ListConfig = {
  sortable: ["date", "number", "product", "name", "status", "qty"],
  defaultSort: "date",
  filters: ["status", "from", "to"],
};

type Row = Awaited<ReturnType<typeof listProductRequests>>["items"][number];

export default async function AdminProductRequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const status = STATUSES.includes(query.filters.status as ProductRequestStatus)
    ? (query.filters.status as ProductRequestStatus)
    : undefined;
  const filtered = Boolean(query.q || status || query.filters.from);

  let rows: Row[] = [];
  let total = 0;
  let pages = 1;
  try {
    const res = await listProductRequests({
      status,
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
      key: "ref",
      header: "Reference",
      sortKey: "number",
      sortDir: "asc",
      cell: (r) => (
        <Link
          href={`/admin/product-requests/${String(r._id)}`}
          className="text-primary font-mono text-xs font-medium hover:underline"
        >
          {r.requestNumber}
        </Link>
      ),
    },
    {
      key: "product",
      header: "Product",
      sortKey: "product",
      sortDir: "asc",
      cell: (r) => r.productName,
    },
    {
      key: "name",
      header: "Requested by",
      sortKey: "name",
      sortDir: "asc",
      cell: (r) => <span className="text-muted-foreground">{r.name}</span>,
    },
    {
      key: "qty",
      header: "Qty",
      align: "right",
      sortKey: "qty",
      cell: (r) => (
        <span className="text-muted-foreground tabular-nums">
          {r.quantity ?? "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      sortDir: "asc",
      cell: (r) => <StatusBadge>{r.status}</StatusBadge>,
    },
    {
      key: "date",
      header: "Date",
      align: "right",
      sortKey: "date",
      cell: (r) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(r.createdAt).toLocaleDateString("en-GB")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      mobile: "actions",
      className: "w-10",
      cell: (r) => (
        <RowActions
          label={`Actions for ${r.requestNumber}`}
          actions={[
            {
              label: "Open request",
              href: `/admin/product-requests/${String(r._id)}`,
              icon: "view",
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Product requests"
        description="Sourcing requests for items we don't stock yet, submitted from Spiber Kart."
      />

      <ListToolbar
        search={{ placeholder: "Search request #, product, requester…" }}
        filters={[
          {
            param: "status",
            label: "Status",
            kind: "pills",
            options: STATUSES.map((s) => ({ value: s, label: s })),
          },
        ]}
        dateRange
        sort={{
          options: [
            { value: "date", label: "Date" },
            { value: "product", label: "Product", defaultDir: "asc" },
            { value: "name", label: "Requester", defaultDir: "asc" },
            { value: "qty", label: "Quantity" },
            { value: "status", label: "Status", defaultDir: "asc" },
            { value: "number", label: "Reference", defaultDir: "asc" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        total={total}
        countLabel={`${total} request${total === 1 ? "" : "s"}`}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => String(r._id)}
        sort={{ key: query.sort, dir: query.dir }}
        empty={
          filtered
            ? "No product requests match these filters."
            : "No product requests yet."
        }
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "Requests arrive from the Request a product form on Spiber Kart."
        }
        minWidth={800}
      />

      <Pagination
        page={query.page}
        pages={pages}
        total={total}
        pageSize={query.pageSize}
        noun="requests"
      />
    </div>
  );
}
