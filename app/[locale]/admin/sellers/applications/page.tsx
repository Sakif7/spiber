import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listSellerApplications } from "@/lib/repositories/seller-applications.repo";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof listSellerApplications>>[number];

export default async function AdminSellerApplicationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: Row[] = [];
  try {
    rows = await listSellerApplications();
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "ref",
      header: "Reference",
      cell: (a) => (
        <Link
          href={`/admin/sellers/applications/${String(a._id)}`}
          className="text-primary font-mono text-xs font-medium hover:underline"
        >
          {a.applicationNumber}
        </Link>
      ),
    },
    {
      key: "businessName",
      header: "Business",
      cell: (a) => a.businessName,
    },
    {
      key: "contactName",
      header: "Contact",
      cell: (a) => a.contactName,
    },
    {
      key: "status",
      header: "Status",
      cell: (a) => <StatusBadge>{a.status}</StatusBadge>,
    },
    {
      key: "date",
      header: "Date",
      align: "right",
      cell: (a) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(a.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Seller applications"
        description="Requests to join the Spiber Kart marketplace."
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(a) => String(a._id)}
        empty="No seller applications yet."
        minWidth={760}
      />
    </div>
  );
}
