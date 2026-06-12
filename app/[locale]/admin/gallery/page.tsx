import { setRequestLocale } from "next-intl/server";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { DeleteRowButton } from "@/components/admin/delete-row-button";
import { listAdminAlbums } from "@/lib/repositories/gallery.repo";
import { localize } from "@/lib/schemas/localized";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof listAdminAlbums>>["items"][number];

export default async function AdminGalleryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: Row[] = [];
  try {
    rows = (await listAdminAlbums({ pageSize: 100 })).items;
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "title",
      header: "Title",
      cell: (a) => (
        <Link
          href={`/admin/gallery/${String(a._id)}`}
          className="text-primary font-medium hover:underline"
        >
          {localize(a.title, "en")}
        </Link>
      ),
    },
    {
      key: "photos",
      header: "Photos",
      align: "right",
      cell: (a) => a.images?.length ?? 0,
    },
    {
      key: "date",
      header: "Date",
      cell: (a) => (
        <span className="text-muted-foreground">
          {a.date ? new Date(a.date).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (a) => <StatusBadge>{a.status}</StatusBadge>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (a) => (
        <div className="inline-flex items-center gap-2">
          <Link
            href={`/admin/gallery/${String(a._id)}`}
            className="text-primary font-medium hover:underline"
          >
            Edit
          </Link>
          <DeleteRowButton
            endpoint={`/api/admin/gallery/${String(a._id)}`}
            title={localize(a.title, "en")}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Gallery"
        description="Photo albums for company events and milestones."
        action={
          <Button asChild>
            <Link href="/admin/gallery/new">
              <Plus className="size-4" />
              New album
            </Link>
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(a) => String(a._id)}
        empty="No albums yet."
        minWidth={720}
      />
    </div>
  );
}
