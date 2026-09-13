import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listTravelRequests } from "@/lib/repositories/travelRequests.repo";
import { formatBDT } from "@/lib/money";
import {
  travelRequestStatusEnum,
  travelRequestTypeEnum,
  type TravelRequestStatus,
  type TravelRequestType,
} from "@/lib/schemas/travel-request";
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

const STATUSES = travelRequestStatusEnum.options;
const TYPES = travelRequestTypeEnum.options;
const TYPE_LABEL: Record<TravelRequestType, string> = {
  air: "Air ticket",
  hotel: "Hotel",
  visa: "Visa",
  transfer: "Transfer",
};

const LIST: ListConfig = {
  sortable: ["date", "number", "contact", "status", "type", "quoted"],
  defaultSort: "date",
  filters: ["status", "type", "from", "to"],
};

type Row = Awaited<ReturnType<typeof listTravelRequests>>["items"][number];

export default async function AdminTravelPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const status = STATUSES.includes(query.filters.status as TravelRequestStatus)
    ? (query.filters.status as TravelRequestStatus)
    : undefined;
  const type = TYPES.includes(query.filters.type as TravelRequestType)
    ? (query.filters.type as TravelRequestType)
    : undefined;
  const filtered = Boolean(query.q || status || type || query.filters.from);

  let rows: Row[] = [];
  let total = 0;
  let pages = 1;
  try {
    const res = await listTravelRequests({
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
      cell: (r) => (
        <Link
          href={`/admin/tourism/travel/${String(r._id)}`}
          className="text-primary font-mono text-xs font-medium hover:underline"
        >
          {r.travelRequestNumber}
        </Link>
      ),
    },
    {
      key: "type",
      header: "Type",
      sortKey: "type",
      sortDir: "asc",
      cell: (r) => TYPE_LABEL[r.type as TravelRequestType] ?? r.type,
    },
    {
      key: "contact",
      header: "Contact",
      sortKey: "contact",
      sortDir: "asc",
      cell: (r) => (
        <span className="text-muted-foreground">{r.contact.name}</span>
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
      key: "quoted",
      header: "Quoted",
      align: "right",
      sortKey: "quoted",
      cell: (r) =>
        r.quote?.amountMinor != null
          ? formatBDT(r.quote.amountMinor, "en")
          : "—",
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
          label={`Actions for ${r.travelRequestNumber}`}
          actions={[
            {
              label: "Open request",
              href: `/admin/tourism/travel/${String(r._id)}`,
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
        title="Travel requests"
        description="Air ticket, hotel, visa, and transfer requests."
      />

      <ListToolbar
        search={{ placeholder: "Search request #, contact name, email…" }}
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
            options: TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] })),
          },
        ]}
        dateRange
        sort={{
          options: [
            { value: "date", label: "Date" },
            { value: "contact", label: "Contact", defaultDir: "asc" },
            { value: "status", label: "Status", defaultDir: "asc" },
            { value: "type", label: "Type", defaultDir: "asc" },
            { value: "quoted", label: "Quoted amount" },
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
            ? "No travel requests match these filters."
            : "No travel requests yet."
        }
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "Requests arrive from the air-ticket, hotel, visa and transfer forms on the Tourism site."
        }
        minWidth={780}
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
