import { setRequestLocale } from "next-intl/server";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { DeleteRowButton } from "@/components/admin/delete-row-button";
import { listAdminEvents } from "@/lib/repositories/events.repo";
import { localize } from "@/lib/schemas/localized";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof listAdminEvents>>["items"][number];

export default async function AdminEventsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: Row[] = [];
  try {
    rows = (await listAdminEvents({ pageSize: 100 })).items;
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "title",
      header: "Title",
      cell: (e) => (
        <Link
          href={`/admin/events/${String(e._id)}`}
          className="text-primary font-medium hover:underline"
        >
          {localize(e.title, "en")}
        </Link>
      ),
    },
    {
      key: "date",
      header: "Date",
      cell: (e) => (
        <span className="text-muted-foreground">
          {e.startDate ? new Date(e.startDate).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      key: "location",
      header: "Location",
      cell: (e) => (e.location ? localize(e.location, "en") : "—"),
    },
    {
      key: "status",
      header: "Status",
      cell: (e) => <StatusBadge>{e.status}</StatusBadge>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (e) => (
        <div className="inline-flex items-center gap-2">
          <Link
            href={`/admin/events/${String(e._id)}`}
            className="text-primary font-medium hover:underline"
          >
            Edit
          </Link>
          <DeleteRowButton
            endpoint={`/api/admin/events/${String(e._id)}`}
            title={localize(e.title, "en")}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Events"
        description="Conferences, webinars, and company milestones."
        action={
          <Button asChild>
            <Link href="/admin/events/new">
              <Plus className="size-4" />
              New event
            </Link>
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(e) => String(e._id)}
        empty="No events yet."
        minWidth={720}
      />
    </div>
  );
}
