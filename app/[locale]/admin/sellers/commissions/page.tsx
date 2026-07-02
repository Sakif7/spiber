import { setRequestLocale } from "next-intl/server";
import { listSellerCommissions } from "@/lib/repositories/seller-commissions.repo";
import { sellerNamesByIds } from "@/lib/repositories/sellers.repo";
import { formatBDT } from "@/lib/money";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof listSellerCommissions>>[number];

export default async function AdminSellerCommissionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: Row[] = [];
  try {
    rows = await listSellerCommissions();
  } catch {
    rows = [];
  }

  let names: Record<string, string> = {};
  try {
    names = await sellerNamesByIds(
      rows.map((r) => String(r.sellerId)).filter(Boolean),
    );
  } catch {
    names = {};
  }

  const columns: Column<Row>[] = [
    {
      key: "order",
      header: "Order",
      className: "font-mono text-xs",
      cell: (r) => r.orderNumber,
    },
    {
      key: "seller",
      header: "Seller",
      cell: (r) => (
        <span className="text-muted-foreground">
          {names[String(r.sellerId)] ?? "—"}
        </span>
      ),
    },
    {
      key: "sales",
      header: "Sales",
      className: "font-mono whitespace-nowrap",
      cell: (r) => formatBDT(r.itemSubtotalMinor),
    },
    {
      key: "commission",
      header: "Commission",
      className: "font-mono whitespace-nowrap",
      cell: (r) => formatBDT(r.commissionAmountMinor),
    },
    {
      key: "earnings",
      header: "Earnings",
      className: "font-mono whitespace-nowrap",
      cell: (r) => formatBDT(r.sellerEarningsMinor),
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
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(r.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Commissions"
        description="Seller earnings accrued from Spiber Kart orders."
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => String(r._id)}
        empty="No commissions yet."
        minWidth={860}
      />
    </div>
  );
}
