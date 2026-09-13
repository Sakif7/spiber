import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listPurchases } from "@/lib/repositories/purchases.repo";
import { formatBDT } from "@/lib/money";
import { localize } from "@/lib/schemas/localized";
import { purchaseStatusEnum, type PurchaseStatus } from "@/lib/schemas/systems";
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

const STATUSES = purchaseStatusEnum.options;

const LIST: ListConfig = {
  sortable: ["date", "number", "email", "status", "total"],
  defaultSort: "date",
  filters: ["status", "from", "to"],
};

type Row = Awaited<ReturnType<typeof listPurchases>>["items"][number];

export default async function AdminPurchasesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const status = STATUSES.includes(query.filters.status as PurchaseStatus)
    ? (query.filters.status as PurchaseStatus)
    : undefined;
  const filtered = Boolean(query.q || status || query.filters.from);

  let rows: Row[] = [];
  let total = 0;
  let pages = 1;
  try {
    const res = await listPurchases({
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
      cell: (p) => (
        <Link
          href={`/admin/software-purchases/${String(p._id)}`}
          className="text-primary font-mono text-xs font-medium hover:underline"
        >
          {p.purchaseNumber}
        </Link>
      ),
    },
    {
      key: "product",
      header: "Product",
      cell: (p) => localize(p.productSnapshot.name, "en"),
    },
    {
      key: "email",
      header: "Customer",
      sortKey: "email",
      sortDir: "asc",
      cell: (p) => <span className="text-muted-foreground">{p.email}</span>,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      sortKey: "total",
      className: "font-mono font-medium whitespace-nowrap",
      cell: (p) => formatBDT(p.totalMinor, "en"),
    },
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      sortDir: "asc",
      cell: (p) => <StatusBadge>{p.status}</StatusBadge>,
    },
    {
      key: "date",
      header: "Date",
      align: "right",
      sortKey: "date",
      cell: (p) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(p.createdAt).toLocaleDateString("en-GB")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      mobile: "actions",
      className: "w-10",
      cell: (p) => (
        <RowActions
          label={`Actions for ${p.purchaseNumber}`}
          actions={[
            {
              label: "Open purchase",
              href: `/admin/software-purchases/${String(p._id)}`,
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
        title="Software purchases"
        description="Digital product purchases — fulfilment, licensing, and delivery."
      />

      <ListToolbar
        search={{ placeholder: "Search purchase #, customer email, product…" }}
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
            { value: "total", label: "Total" },
            { value: "status", label: "Status", defaultDir: "asc" },
            { value: "email", label: "Customer", defaultDir: "asc" },
            { value: "number", label: "Reference", defaultDir: "asc" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        total={total}
        countLabel={`${total} purchase${total === 1 ? "" : "s"}`}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(p) => String(p._id)}
        sort={{ key: query.sort, dir: query.dir }}
        empty={
          filtered ? "No purchases match these filters." : "No purchases yet."
        }
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "Purchases appear when a signed-in customer buys a Digihealth software product."
        }
        minWidth={800}
      />

      <Pagination
        page={query.page}
        pages={pages}
        total={total}
        pageSize={query.pageSize}
        noun="purchases"
      />
    </div>
  );
}
