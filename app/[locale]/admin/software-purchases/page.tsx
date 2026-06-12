import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listPurchases } from "@/lib/repositories/purchases.repo";
import { localize } from "@/lib/schemas/localized";
import { formatBDT } from "@/lib/money";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof listPurchases>>["items"][number];

export default async function AdminPurchasesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: Row[] = [];
  try {
    rows = (await listPurchases({ pageSize: 100 })).items;
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "ref",
      header: "Reference",
      cell: (p) => (
        <Link
          href={`/admin/software-purchases/${String(p._id)}`}
          className="text-primary font-mono text-xs font-medium hover:underline"
        >
          {p.purchaseNumber}
        </Link>
      ),
    },
    {
      key: "product",
      header: "Product",
      cell: (p) => localize(p.productSnapshot.name, "en"),
    },
    {
      key: "email",
      header: "Email",
      cell: (p) => <span className="text-muted-foreground">{p.email}</span>,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      cell: (p) => formatBDT(p.totalMinor, "en"),
    },
    {
      key: "status",
      header: "Status",
      cell: (p) => <StatusBadge>{p.status}</StatusBadge>,
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Software purchases"
        description="Digital product purchases — fulfilment, licensing, and delivery."
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(p) => String(p._id)}
        empty="No purchases yet."
        minWidth={720}
      />
    </div>
  );
}
