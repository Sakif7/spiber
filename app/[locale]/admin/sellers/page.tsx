import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listSellers } from "@/lib/repositories/sellers.repo";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof listSellers>>[number];

export default async function AdminSellersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: Row[] = [];
  try {
    rows = await listSellers();
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "displayName",
      header: "Seller",
      cell: (s) => (
        <Link
          href={`/admin/sellers/${String(s._id)}`}
          className="text-primary font-mono text-xs font-medium hover:underline"
        >
          {s.displayName}
        </Link>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (s) => <StatusBadge>{s.status}</StatusBadge>,
    },
    {
      key: "commission",
      header: "Commission",
      cell: (s) => (
        <span className="text-muted-foreground">
          {s.commissionBp == null ? "Default" : `${s.commissionBp / 100}%`}
        </span>
      ),
    },
    {
      key: "joined",
      header: "Joined",
      align: "right",
      cell: (s) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(s.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Sellers"
        description="Spiber Kart marketplace sellers."
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(s) => String(s._id)}
        empty="No sellers yet."
        minWidth={640}
      />
    </div>
  );
}
