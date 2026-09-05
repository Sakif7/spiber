import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listSellerApplicationsForAdmin } from "@/lib/repositories/seller-applications.repo";
import {
  sellerApplicationStatusEnum,
  type SellerApplicationStatus,
} from "@/lib/schemas/seller-application";
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

const STATUSES = sellerApplicationStatusEnum.options;

const LIST: ListConfig = {
  sortable: ["date", "number", "business", "status"],
  defaultSort: "date",
  filters: ["status", "from", "to"],
};

type Row = Awaited<
  ReturnType<typeof listSellerApplicationsForAdmin>
>["items"][number];

export default async function AdminSellerApplicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const status = STATUSES.includes(
    query.filters.status as SellerApplicationStatus,
  )
    ? (query.filters.status as SellerApplicationStatus)
    : undefined;
  const filtered = Boolean(query.q || status || query.filters.from);

  let rows: Row[] = [];
  let total = 0;
  let pages = 1;
  try {
    const res = await listSellerApplicationsForAdmin({
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
      cell: (a) => (
        <Link
          href={`/admin/sellers/applications/${String(a._id)}`}
          className="text-primary font-mono text-xs font-medium hover:underline"
        >
          {a.applicationNumber}
        </Link>
      ),
    },
    {
      key: "businessName",
      header: "Business",
      sortKey: "business",
      sortDir: "asc",
      cell: (a) => a.businessName,
    },
    {
      key: "contactName",
      header: "Contact",
      cell: (a) => (
        <span className="text-muted-foreground">{a.contactName}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      sortDir: "asc",
      cell: (a) => <StatusBadge>{a.status}</StatusBadge>,
    },
    {
      key: "date",
      header: "Date",
      align: "right",
      sortKey: "date",
      cell: (a) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(a.createdAt).toLocaleDateString("en-GB")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      mobile: "actions",
      className: "w-10",
      cell: (a) => (
        <RowActions
          label={`Actions for ${a.applicationNumber}`}
          actions={[
            {
              label: "Open application",
              href: `/admin/sellers/applications/${String(a._id)}`,
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
        title="Seller applications"
        description="Requests to join the Spiber Kart marketplace, with KYC documents."
      />

      <ListToolbar
        search={{ placeholder: "Search application #, business, contact…" }}
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
            { value: "business", label: "Business", defaultDir: "asc" },
            { value: "status", label: "Status", defaultDir: "asc" },
            { value: "number", label: "Reference", defaultDir: "asc" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        total={total}
        countLabel={`${total} application${total === 1 ? "" : "s"}`}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(a) => String(a._id)}
        sort={{ key: query.sort, dir: query.dir }}
        empty={
          filtered
            ? "No seller applications match these filters."
            : "No seller applications yet."
        }
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "Applications arrive from the Become a seller page on Spiber Kart."
        }
        minWidth={760}
      />

      <Pagination
        page={query.page}
        pages={pages}
        total={total}
        pageSize={query.pageSize}
        noun="applications"
      />
    </div>
  );
}
