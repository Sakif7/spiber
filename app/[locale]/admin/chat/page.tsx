import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listChatConversations } from "@/lib/repositories/chat.repo";
import { chatStatusEnum, type ChatStatus } from "@/lib/schemas/chat";
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

const STATUSES = chatStatusEnum.options;

const LIST: ListConfig = {
  sortable: ["updated", "date", "status", "ref"],
  defaultSort: "updated",
  filters: ["status", "leads", "from", "to"],
};

type Row = Awaited<ReturnType<typeof listChatConversations>>["items"][number];

function firstUserMessage(r: Row): string {
  const m = r.messages?.find((x) => x.role === "user");
  const text = m?.text ?? r.messages?.[0]?.text ?? "";
  return text.length > 70 ? `${text.slice(0, 70)}…` : text || "—";
}

export default async function AdminChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const status = STATUSES.includes(query.filters.status as ChatStatus)
    ? (query.filters.status as ChatStatus)
    : undefined;
  const leadsOnly = query.filters.leads === "1";
  const filtered = Boolean(
    query.q || status || leadsOnly || query.filters.from,
  );

  let rows: Row[] = [];
  let total = 0;
  let pages = 1;
  try {
    const res = await listChatConversations({
      status,
      leadsOnly,
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
      sortKey: "ref",
      sortDir: "asc",
      mobile: "primary",
      cell: (r) => (
        <Link
          href={`/admin/chat/${String(r._id)}`}
          className="text-primary font-mono text-xs font-medium hover:underline"
        >
          {r.ref}
        </Link>
      ),
    },
    {
      key: "preview",
      header: "First message",
      mobile: "meta",
      cell: (r) => (
        <span className="text-foreground">{firstUserMessage(r)}</span>
      ),
    },
    {
      key: "lead",
      header: "Lead",
      mobile: "meta",
      cell: (r) =>
        r.lead ? (
          <span className="text-foreground">
            {r.lead.name}
            <span className="text-muted-foreground"> · {r.lead.email}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "turns",
      header: "Turns",
      align: "right",
      mobile: "meta",
      cell: (r) => (
        <span className="text-muted-foreground tabular-nums">
          {r.messages?.length ?? 0}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      sortDir: "asc",
      mobile: "meta",
      cell: (r) => <StatusBadge>{r.status}</StatusBadge>,
    },
    {
      key: "date",
      header: "Updated",
      align: "right",
      sortKey: "updated",
      mobile: "meta",
      cell: (r) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(r.updatedAt).toLocaleDateString("en-GB")}
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
          label={`Actions for ${r.ref}`}
          actions={[
            {
              label: "Open transcript",
              href: `/admin/chat/${String(r._id)}`,
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
        title="Chat inbox"
        description="Conversations and captured leads from the website chat assistant."
      />

      <ListToolbar
        search={{ placeholder: "Search reference, lead name or email…" }}
        filters={[
          {
            param: "status",
            label: "Status",
            kind: "pills",
            options: STATUSES.map((s) => ({ value: s, label: s })),
          },
          {
            param: "leads",
            label: "Leads",
            kind: "pills",
            options: [{ value: "1", label: "With a lead" }],
          },
        ]}
        dateRange
        sort={{
          options: [
            { value: "updated", label: "Last activity" },
            { value: "date", label: "Started" },
            { value: "status", label: "Status", defaultDir: "asc" },
            { value: "ref", label: "Reference", defaultDir: "asc" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        total={total}
        countLabel={`${total} conversation${total === 1 ? "" : "s"}`}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => String(r._id)}
        sort={{ key: query.sort, dir: query.dir }}
        empty={
          filtered
            ? "No conversations match these filters."
            : "No conversations yet."
        }
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "A conversation is saved whenever a visitor talks to the website chat assistant."
        }
        minWidth={860}
      />

      <Pagination
        page={query.page}
        pages={pages}
        total={total}
        pageSize={query.pageSize}
        noun="conversations"
      />
    </div>
  );
}
