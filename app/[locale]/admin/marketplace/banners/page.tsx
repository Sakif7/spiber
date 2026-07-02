import { setRequestLocale } from "next-intl/server";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { listAllBanners } from "@/lib/repositories/banners.repo";
import { localize } from "@/lib/schemas/localized";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof listAllBanners>>[number];

export default async function AdminBannersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let banners: Row[] = [];
  try {
    banners = await listAllBanners();
  } catch {
    banners = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "title",
      header: "Title",
      cell: (b) => (
        <Link
          href={`/admin/marketplace/banners/${String(b._id)}`}
          className="text-primary font-medium hover:underline"
        >
          {localize(b.title, "en")}
        </Link>
      ),
    },
    {
      key: "slot",
      header: "Slot",
      cell: (b) => <span className="capitalize">{b.slot}</span>,
    },
    {
      key: "active",
      header: "Active",
      cell: (b) => (b.active ? "Yes" : "No"),
    },
    {
      key: "position",
      header: "Position",
      cell: (b) => b.position,
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Banners"
        description="Spiber Kart promotional banners and their schedule slots."
        action={
          <Button asChild>
            <Link href="/admin/marketplace/banners/new">
              <Plus className="size-4" />
              New banner
            </Link>
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={banners}
        getRowKey={(b) => String(b._id)}
        empty="No banners yet."
        minWidth={640}
      />
    </div>
  );
}
