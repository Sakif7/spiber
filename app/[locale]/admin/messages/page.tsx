import { setRequestLocale } from "next-intl/server";
import { listContactMessages } from "@/lib/repositories/contact-messages.repo";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof listContactMessages>>["items"][number];

/** Contact-form submissions ("Get in Touch") — read view for triage. */
export default async function AdminMessagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: Row[] = [];
  try {
    rows = (await listContactMessages({ pageSize: 100 })).items;
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
    { key: "name", header: "From", cell: (r) => r.name },
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
      cell: (r) => <StatusBadge>{r.status}</StatusBadge>,
    },
    {
      key: "date",
      header: "Date",
      align: "right",
      cell: (r) => (
        <span className="text-muted-foreground">
          {new Date(r.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Messages"
        description="Submissions from the website contact form."
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => String(r._id)}
        empty="No contact messages yet."
        minWidth={900}
      />
    </div>
  );
}
