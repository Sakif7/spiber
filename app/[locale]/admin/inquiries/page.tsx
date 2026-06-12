import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listInquiries } from "@/lib/repositories/inquiries.repo";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof listInquiries>>["items"][number];

export default async function AdminInquiriesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: Row[] = [];
  try {
    rows = (await listInquiries({ pageSize: 100 })).items;
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "ref",
      header: "Reference",
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
      cell: (q) => (
        <span className="text-muted-foreground capitalize">{q.division}</span>
      ),
    },
    { key: "name", header: "Name", cell: (q) => q.name },
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
      cell: (q) => <StatusBadge>{q.status}</StatusBadge>,
    },
    {
      key: "date",
      header: "Date",
      align: "right",
      cell: (q) => (
        <span className="text-muted-foreground">
          {new Date(q.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Inquiries" />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(q) => String(q._id)}
        empty="No inquiries yet."
        minWidth={760}
      />
    </div>
  );
}
