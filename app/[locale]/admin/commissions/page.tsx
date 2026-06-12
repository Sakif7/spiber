import { setRequestLocale } from "next-intl/server";
import {
  listCommissions,
  commissionTotals,
} from "@/lib/repositories/commissions.repo";
import { formatBDT } from "@/lib/money";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof listCommissions>>[number];

export default async function AdminCommissionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: Row[] = [];
  let totals = { accruedMinor: 0, paidMinor: 0, voidMinor: 0 };
  try {
    [rows, totals] = await Promise.all([listCommissions(), commissionTotals()]);
  } catch {
    rows = [];
  }

  const summary = [
    { label: "Accrued", value: totals.accruedMinor },
    { label: "Paid", value: totals.paidMinor },
    { label: "Void", value: totals.voidMinor },
  ];

  const columns: Column<Row>[] = [
    { key: "app", header: "App", cell: (c) => c.externalApp },
    {
      key: "base",
      header: "Base",
      align: "right",
      cell: (c) => (
        <span className="text-muted-foreground">
          {formatBDT(c.basePriceMinor, "en")}
        </span>
      ),
    },
    {
      key: "rate",
      header: "Rate",
      align: "right",
      cell: (c) => (
        <span className="text-muted-foreground">
          {(c.rateBp / 100).toFixed(2)}%
        </span>
      ),
    },
    {
      key: "commission",
      header: "Commission",
      align: "right",
      cell: (c) => (
        <span className="font-medium">{formatBDT(c.amountMinor, "en")}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (c) => <StatusBadge>{c.status}</StatusBadge>,
    },
    {
      key: "date",
      header: "Date",
      align: "right",
      cell: (c) => (
        <span className="text-muted-foreground">
          {new Date(c.accruedAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Affiliate commissions"
        description="Owner commission ledger for external-app provisioning — accrued, paid, and voided."
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
        {summary.map((s) => (
          <div
            key={s.label}
            className="bg-card grid gap-1 rounded-lg p-5 shadow-[var(--shadow-sm)]"
          >
            <span className="text-muted-foreground font-mono text-xs uppercase">
              {s.label}
            </span>
            <strong className="text-foreground text-2xl font-semibold">
              {formatBDT(s.value, "en")}
            </strong>
          </div>
        ))}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(c) => String(c._id)}
        empty="No commissions recorded yet."
        minWidth={760}
      />
    </div>
  );
}
