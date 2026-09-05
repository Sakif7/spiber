import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listCreditApplicationsForAdmin } from "@/lib/repositories/credit-applications.repo";
import {
  creditApplicationStatusEnum,
  type CreditApplicationStatus,
} from "@/lib/schemas/credit";
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

const STATUSES = creditApplicationStatusEnum.options;

const LIST: ListConfig = {
  sortable: ["date", "number", "organization", "status"],
  defaultSort: "date",
  filters: ["status", "from", "to"],
};

type Row = Awaited<
  ReturnType<typeof listCreditApplicationsForAdmin>
>["items"][number];

export default async function AdminCreditApplicationsPage({
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
    query.filters.status as CreditApplicationStatus,
  )
    ? (query.filters.status as CreditApplicationStatus)
    : undefined;
  const filtered = Boolean(query.q || status || query.filters.from);

  let rows: Row[] = [];
  let total = 0;
  let pages = 1;
  try {
    const res = await listCreditApplicationsForAdmin({
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
          href={`/admin/credit/applications/${String(a._id)}`}
          className="text-primary font-mono text-xs font-medium hover:underline"
        >
          {a.applicationNumber}
        </Link>
      ),
    },
    {
      key: "organization",
      header: "Organisation",
      sortKey: "organization",
      sortDir: "asc",
      cell: (a) => a.organization,
    },
    {
      key: "contactName",
      header: "Contact",
      cell: (a) => (
        <span className="text-muted-foreground">{a.contactName}</span>
      ),
    },
    {
      key: "docs",
      header: "Docs",
      align: "right",
      cell: (a) => (
        <span className="text-muted-foreground">{a.documents.length}</span>
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
              href: `/admin/credit/applications/${String(a._id)}`,
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
        title="Credit applications"
        description="Hospitals and clinics applying to buy on Medtrade credit terms."
      />

      <ListToolbar
        search={{ placeholder: "Search application #, organisation, contact…" }}
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
            { value: "organization", label: "Organisation", defaultDir: "asc" },
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
            ? "No credit applications match these filters."
            : "No credit applications yet."
        }
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "Applications arrive from the Medtrade credit facility page."
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
