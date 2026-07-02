import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listProductRequests } from "@/lib/repositories/product-requests.repo";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof listProductRequests>>["items"][number];

export default async function AdminProductRequestsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: Row[] = [];
  try {
    rows = (await listProductRequests({ pageSize: 100 })).items;
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "ref",
      header: "Reference",
      cell: (r) => (
        <Link
          href={`/admin/product-requests/${String(r._id)}`}
          className="text-primary font-mono text-xs font-medium hover:underline"
        >
          {r.requestNumber}
        </Link>
      ),
    },
    {
      key: "product",
      header: "Product",
      cell: (r) => r.productName,
    },
    { key: "name", header: "Requested by", cell: (r) => r.name },
    {
      key: "qty",
      header: "Qty",
      cell: (r) => (
        <span className="text-muted-foreground">{r.quantity ?? "—"}</span>
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
        title="Product requests"
        description="Sourcing requests submitted from Spiber Kart."
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => String(r._id)}
        empty="No product requests yet."
        minWidth={760}
      />
    </div>
  );
}
