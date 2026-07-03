import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listChatConversations } from "@/lib/repositories/chat.repo";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { StatusFilterPills } from "@/components/admin/ui/status-filter";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import type { ChatStatus } from "@/lib/schemas/chat";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof listChatConversations>>["items"][number];

const STATUSES = ["all", "open", "lead", "closed"] as const;

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
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  const { status } = await searchParams;
  setRequestLocale(locale);

  const filter =
    status &&
    STATUSES.includes(status as (typeof STATUSES)[number]) &&
    status !== "all"
      ? (status as ChatStatus)
      : undefined;

  let rows: Row[] = [];
  try {
    rows = (await listChatConversations({ status: filter, pageSize: 100 }))
      .items;
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "ref",
      header: "Reference",
      cell: (r) => (
        <Link
          href={`/admin/chat/${String(r._id)}`}
          className="text-primary font-mono text-xs font-medium hover:underline"
        >
          {r.ref}
        </Link>
      ),
      mobile: "primary",
    },
    {
      key: "preview",
      header: "First message",
      cell: (r) => (
        <span className="text-foreground">{firstUserMessage(r)}</span>
      ),
    },
    {
      key: "lead",
      header: "Lead",
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
      cell: (r) => (
        <span className="text-muted-foreground">{r.messages?.length ?? 0}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => <StatusBadge>{r.status}</StatusBadge>,
    },
    {
      key: "date",
      header: "Updated",
      align: "right",
      cell: (r) => (
        <span className="text-muted-foreground">
          {new Date(r.updatedAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Chat inbox"
        description="Conversations and captured leads from the website chat assistant."
      />
      <StatusFilterPills
        statuses={STATUSES}
        active={status ?? "all"}
        basePath="/admin/chat"
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => String(r._id)}
        empty="No conversations yet."
        minWidth={820}
      />
    </div>
  );
}
