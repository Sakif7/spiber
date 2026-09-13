import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listInquiries } from "@/lib/repositories/inquiries.repo";
import {
  inquiryDivisionEnum,
  inquiryStatusEnum,
  type InquiryDivision,
  type InquiryStatus,
} from "@/lib/schemas/inquiry";
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

const STATUSES = inquiryStatusEnum.options;
const DIVISIONS = inquiryDivisionEnum.options;
/** Public brand names for the legacy division enum values. */
const DIVISION_LABEL: Record<InquiryDivision, string> = {
  systems: "Digihealth",
  tourism: "Tourism",
  consulting: "Consulting",
};

const LIST: ListConfig = {
  sortable: ["date", "number", "name", "status", "division"],
  defaultSort: "date",
  filters: ["status", "division", "from", "to"],
};

type Row = Awaited<ReturnType<typeof listInquiries>>["items"][number];

export default async function AdminInquiriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const status = STATUSES.includes(query.filters.status as InquiryStatus)
    ? (query.filters.status as InquiryStatus)
    : undefined;
  const division = DIVISIONS.includes(query.filters.division as InquiryDivision)
    ? (query.filters.division as InquiryDivision)
    : undefined;
  const filtered = Boolean(query.q || status || division || query.filters.from);

  let rows: Row[] = [];
  let total = 0;
  let pages = 1;
  try {
    const res = await listInquiries({
      status,
      division,
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
      cell: (q) => (
        <Link
          href={`/admin/inquiries/${String(q._id)}`}
          className="text-primary font-mono text-xs font-medium hover:underline"
        >
          {q.inquiryNumber}
        </Link>
      ),
    },
    {
      key: "division",
      header: "Division",
      sortKey: "division",
      sortDir: "asc",
      cell: (q) => (
        <span className="text-muted-foreground">
          {DIVISION_LABEL[q.division as InquiryDivision] ?? q.division}
        </span>
      ),
    },
    {
      key: "name",
      header: "Name",
      sortKey: "name",
      sortDir: "asc",
      cell: (q) => q.name,
    },
    {
      key: "subject",
      header: "Subject",
      cell: (q) => (
        <span className="text-muted-foreground">{q.subject ?? "—"}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      sortDir: "asc",
      cell: (q) => <StatusBadge>{q.status}</StatusBadge>,
    },
    {
      key: "date",
      header: "Date",
      align: "right",
      sortKey: "date",
      cell: (q) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(q.createdAt).toLocaleDateString("en-GB")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      mobile: "actions",
      className: "w-10",
      cell: (q) => (
        <RowActions
          label={`Actions for ${q.inquiryNumber}`}
          actions={[
            {
              label: "Open inquiry",
              href: `/admin/inquiries/${String(q._id)}`,
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
        title="Inquiries"
        description="Custom-solution and quote inquiries — qualify, propose, and close."
      />

      <ListToolbar
        search={{ placeholder: "Search inquiry #, name, email, organization…" }}
        filters={[
          {
            param: "status",
            label: "Status",
            kind: "pills",
            options: STATUSES.map((s) => ({ value: s, label: s })),
          },
          {
            param: "division",
            label: "Division",
            kind: "pills",
            options: DIVISIONS.map((d) => ({
              value: d,
              label: DIVISION_LABEL[d],
            })),
          },
        ]}
        dateRange
        sort={{
          options: [
            { value: "date", label: "Date" },
            { value: "name", label: "Name", defaultDir: "asc" },
            { value: "status", label: "Status", defaultDir: "asc" },
            { value: "division", label: "Division", defaultDir: "asc" },
            { value: "number", label: "Reference", defaultDir: "asc" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        total={total}
        countLabel={`${total} inquir${total === 1 ? "y" : "ies"}`}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(q) => String(q._id)}
        sort={{ key: query.sort, dir: query.dir }}
        empty={
          filtered ? "No inquiries match these filters." : "No inquiries yet."
        }
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "Inquiries arrive from the Digihealth custom-solution and quote-request forms."
        }
        minWidth={800}
      />

      <Pagination
        page={query.page}
        pages={pages}
        total={total}
        pageSize={query.pageSize}
        noun="inquiries"
      />
    </div>
  );
}
