import { setRequestLocale } from "next-intl/server";
import { listContactMessages } from "@/lib/repositories/contact-messages.repo";
import {
  contactInquiryTypeEnum,
  contactStatusEnum,
  type ContactStatus,
} from "@/lib/schemas/contact";
import {
  parseListQuery,
  type ListConfig,
  type SearchParamsInput,
} from "@/lib/admin/list-params";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ListToolbar } from "@/components/admin/ui/list-toolbar";
import { Pagination } from "@/components/admin/ui/pagination";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

const STATUSES = contactStatusEnum.options;
const TYPES = contactInquiryTypeEnum.options;

const LIST: ListConfig = {
  sortable: ["date", "name", "status", "type"],
  defaultSort: "date",
  filters: ["status", "type", "from", "to"],
};

type Row = Awaited<ReturnType<typeof listContactMessages>>["items"][number];

/** Contact-form submissions ("Get in Touch") — read view for triage. */
export default async function AdminMessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const status = STATUSES.includes(query.filters.status as ContactStatus)
    ? (query.filters.status as ContactStatus)
    : undefined;
  const inquiryType = (TYPES as readonly string[]).includes(query.filters.type)
    ? query.filters.type
    : undefined;
  const filtered = Boolean(
    query.q || status || inquiryType || query.filters.from,
  );

  let rows: Row[] = [];
  let total = 0;
  let pages = 1;
  try {
    const res = await listContactMessages({
      status,
      inquiryType,
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
      cell: (r) => (
        <span className="text-primary font-mono text-xs font-medium">
          {r.contactNumber}
        </span>
      ),
    },
    {
      key: "name",
      header: "From",
      sortKey: "name",
      sortDir: "asc",
      cell: (r) => r.name,
    },
    {
      key: "contact",
      header: "Contact",
      mobile: "meta",
      cell: (r) => (
        <span className="text-muted-foreground">
          {r.email}
          {r.phone ? ` · ${r.phone}` : ""}
        </span>
      ),
    },
    {
      key: "type",
      header: "Type",
      sortKey: "type",
      sortDir: "asc",
      mobile: "meta",
      cell: (r) => <span className="capitalize">{r.inquiryType}</span>,
    },
    {
      key: "message",
      header: "Message",
      cell: (r) => (
        <span
          className="text-muted-foreground block max-w-[26rem] truncate"
          title={r.message}
        >
          {r.message}
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
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Messages"
        description="Submissions from the website contact form."
      />

      <ListToolbar
        search={{ placeholder: "Search reference, name, email, message…" }}
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
            { value: "name", label: "Name", defaultDir: "asc" },
            { value: "status", label: "Status", defaultDir: "asc" },
            { value: "type", label: "Type", defaultDir: "asc" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        total={total}
        countLabel={`${total} message${total === 1 ? "" : "s"}`}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => String(r._id)}
        sort={{ key: query.sort, dir: query.dir }}
        empty={
          filtered
            ? "No messages match these filters."
            : "No contact messages yet."
        }
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "Submissions from the Get in Touch form on the website land here."
        }
        minWidth={920}
      />

      <Pagination
        page={query.page}
        pages={pages}
        total={total}
        pageSize={query.pageSize}
        noun="messages"
      />
    </div>
  );
}
