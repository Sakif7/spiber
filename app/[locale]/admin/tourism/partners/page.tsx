import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listPartnerApplications } from "@/lib/repositories/partnerApplications.repo";
import {
  partnerApplicationStatusEnum,
  partnerTypeEnum,
  type PartnerApplicationStatus,
  type PartnerType,
} from "@/lib/schemas/partner-application";
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

const STATUSES = partnerApplicationStatusEnum.options;
const TYPES = partnerTypeEnum.options;

const LIST: ListConfig = {
  sortable: ["date", "number", "organization", "status", "type"],
  defaultSort: "date",
  filters: ["status", "type", "from", "to"],
};

type Row = Awaited<ReturnType<typeof listPartnerApplications>>["items"][number];

export default async function AdminPartnersPage({
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
    query.filters.status as PartnerApplicationStatus,
  )
    ? (query.filters.status as PartnerApplicationStatus)
    : undefined;
  const type = TYPES.includes(query.filters.type as PartnerType)
    ? (query.filters.type as PartnerType)
    : undefined;
  const filtered = Boolean(query.q || status || type || query.filters.from);

  let rows: Row[] = [];
  let total = 0;
  let pages = 1;
  try {
    const res = await listPartnerApplications({
      status,
      type,
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
          href={`/admin/tourism/partners/${String(a._id)}`}
          className="text-primary font-mono text-xs font-medium hover:underline"
        >
          {a.partnerApplicationNumber}
        </Link>
      ),
    },
    {
      key: "org",
      header: "Organization",
      sortKey: "organization",
      sortDir: "asc",
      cell: (a) => a.orgInfo.name,
    },
    {
      key: "contact",
      header: "Contact",
      cell: (a) => (
        <span className="text-muted-foreground">{a.contact?.name ?? "—"}</span>
      ),
    },
    {
      key: "type",
      header: "Type",
      sortKey: "type",
      sortDir: "asc",
      cell: (a) => <span className="capitalize">{a.type}</span>,
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
          label={`Actions for ${a.partnerApplicationNumber}`}
          actions={[
            {
              label: "Open application",
              href: `/admin/tourism/partners/${String(a._id)}`,
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
        title="Partner applications"
        description="Hospitals, agencies, and partners applying to join the network."
      />

      <ListToolbar
        search={{ placeholder: "Search application #, organization, contact…" }}
        filters={[
          {
            param: "status",
            label: "Status",
            kind: "pills",
            options: STATUSES.map((s) => ({ value: s, label: s })),
          },
          {
            param: "type",
            label: "Type",
            kind: "pills",
            options: TYPES.map((t) => ({ value: t, label: t })),
          },
        ]}
        dateRange
        sort={{
          options: [
            { value: "date", label: "Date" },
            { value: "organization", label: "Organization", defaultDir: "asc" },
            { value: "status", label: "Status", defaultDir: "asc" },
            { value: "type", label: "Type", defaultDir: "asc" },
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
            ? "No partner applications match these filters."
            : "No partner applications yet."
        }
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "Applications arrive from the Become a partner form on the Tourism site."
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
