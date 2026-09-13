import { setRequestLocale } from "next-intl/server";
import { myPayslips, type Payslip } from "@/lib/services/me.service";
import { formatBDT } from "@/lib/money";
import { monthLabel } from "@/lib/hr/months";
import { holdingPercent } from "@/lib/hr/share-pool";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { DetailCard, DetailRow } from "@/components/admin/ui/detail";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { employeeOrRedirect, day } from "../_shared";

export const dynamic = "force-dynamic";

type Row = {
  month: string;
  label: string;
  scheme: string;
  amount: string;
  reimbursements: string;
  paid: string;
  status: "approved" | "estimate";
};

const schemeLabel = (line: Payslip["line"], pool: number | null) =>
  line.payScheme === "revenue_share"
    ? typeof line.shares === "number"
      ? `${line.shares.toLocaleString("en-BD")} shares${pool ? ` · ${holdingPercent(line.shares, pool)}% of the pool` : ""}`
      : "Shareholder"
    : line.payScheme === "fixed"
      ? "Fixed salary"
      : "—";

/** Only my own line of each payroll month — never the run itself. */
export default async function MyPayslipsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await employeeOrRedirect(locale, "/admin/me/payslips");
  const { approved, estimate } = await myPayslips(session);

  const rows: Row[] = approved.map((p) => ({
    month: p.month,
    label: monthLabel(p.month),
    scheme: schemeLabel(p.line, p.poolShares),
    amount: formatBDT(p.line.amountMinor, "en"),
    reimbursements:
      p.reimbursementMinor > 0 ? formatBDT(p.reimbursementMinor, "en") : "—",
    paid: p.line.paidAt ? day(p.line.paidAt) : "Not yet",
    status: "approved",
  }));

  const columns: Column<Row>[] = [
    {
      key: "month",
      header: "Month",
      cell: (r) => <span className="font-medium">{r.label}</span>,
    },
    {
      key: "scheme",
      header: "Basis",
      mobile: "meta",
      cell: (r) => <span className="text-muted-foreground">{r.scheme}</span>,
    },
    {
      key: "amount",
      header: "Pay",
      align: "right",
      cell: (r) => <span className="font-mono text-xs">{r.amount}</span>,
    },
    {
      key: "reimb",
      header: "Reimbursed with it",
      align: "right",
      mobile: "meta",
      cell: (r) => (
        <span className="font-mono text-xs">{r.reimbursements}</span>
      ),
    },
    {
      key: "paid",
      header: "Paid",
      mobile: "meta",
      cell: (r) =>
        r.paid === "Not yet" ? (
          <StatusBadge tone="warning">Not yet</StatusBadge>
        ) : (
          <span className="text-muted-foreground">{r.paid}</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="My payslips"
        description="Your own line of each approved payroll month. Nothing else of the month is shown here."
      />
      {estimate && (
        <DetailCard
          title={`${monthLabel(estimate.month)} — open month`}
          description="An estimate from this month's figures so far. It becomes final when the office approves the month."
          action={<StatusBadge tone="info">Estimate</StatusBadge>}
        >
          <DetailRow label="Basis">
            {schemeLabel(estimate.line, estimate.poolShares)}
          </DetailRow>
          <DetailRow label="Pay so far" mono>
            {formatBDT(estimate.line.amountMinor, "en")}
          </DetailRow>
          {estimate.reimbursementMinor > 0 && (
            <DetailRow label="Approved claims to be paid with it" mono>
              {formatBDT(estimate.reimbursementMinor, "en")}
            </DetailRow>
          )}
        </DetailCard>
      )}
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.month}
        empty="No approved payroll month includes you yet."
        minWidth={640}
      />
    </div>
  );
}
