import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listQuotations } from "@/lib/repositories/quotations.repo";
import { formatBDT } from "@/lib/money";
import type { QuotationStatus } from "@/lib/schemas/quotation";
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

const STATUSES: QuotationStatus[] = [
  "new",
  "quoted",
  "negotiating",
  "won",
  "lost",
];

const LIST: ListConfig = {
  sortable: ["date", "number", "requester", "status", "quoted"],
  defaultSort: "date",
  filters: ["status", "from", "to"],
};

type Row = Awaited<ReturnType<typeof listQuotations>>["items"][number];

export default async function AdminQuotationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const status = STATUSES.includes(query.filters.status as QuotationStatus)
    ? (query.filters.status as QuotationStatus)
    : undefined;
  const filtered = Boolean(query.q || status || query.filters.from);

  let rows: Row[] = [];
  let total = 0;
  let pages = 1;
  try {
    const res = await listQuotations({
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
      cell: (q) => (
        <Link
          href={`/admin/quotations/${String(q._id)}`}
          className="text-primary font-mono text-xs font-medium hover:underline"
        >
          {q.quotationNumber}
        </Link>
      ),
    },
    {
      key: "requester",
      header: "Requester",
      sortKey: "requester",
      sortDir: "asc",
      cell: (q) => q.contact.name,
    },
    {
      key: "organization",
      header: "Organization",
      cell: (q) => (
        <span className="text-muted-foreground">
          {q.contact.organization ?? "—"}
        </span>
      ),
    },
    {
      key: "items",
      header: "Items",
      align: "right",
      cell: (q) => q.items.length,
    },
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      sortDir: "asc",
      cell: (q) => <StatusBadge>{q.status}</StatusBadge>,
    },
    {
      key: "quoted",
      header: "Quoted",
      align: "right",
      sortKey: "quoted",
      cell: (q) =>
        q.quote?.amountMinor != null
          ? formatBDT(q.quote.amountMinor, "en")
          : "—",
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
          label={`Actions for ${q.quotationNumber}`}
          actions={[
            {
              label: "Open request",
              href: `/admin/quotations/${String(q._id)}`,
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
        title="Quotations"
        description="Medtrade quotation (RFQ) pipeline — review, quote, and close."
        action={
          // eslint-disable-next-line @next/next/no-html-link-for-pages -- API CSV download, not a page route
          <a
            href="/api/admin/quotations/export"
            className="text-primary text-[13px] font-medium hover:underline"
          >
            Export CSV
          </a>
        }
      />

      <ListToolbar
        search={{ placeholder: "Search reference, requester, organization…" }}
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
            { value: "quoted", label: "Quoted amount" },
            { value: "status", label: "Status", defaultDir: "asc" },
            { value: "requester", label: "Requester", defaultDir: "asc" },
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
        getRowKey={(q) => String(q._id)}
        sort={{ key: query.sort, dir: query.dir }}
        empty={
          filtered
            ? "No quotation requests match these filters."
            : "No quotation requests yet."
        }
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "Requests arrive here when a customer asks for a quote from a Medtrade product page or their quote list."
        }
        minWidth={820}
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
