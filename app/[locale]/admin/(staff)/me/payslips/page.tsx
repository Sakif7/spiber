import { setRequestLocale } from "next-intl/server";
import {
  myNextPayout,
  myPayouts,
  myPayslips,
  type Payslip,
} from "@/lib/services/me.service";
import { formatBDT } from "@/lib/money";
import { dayOf, formatDay, labelOfKey, periodLabel } from "@/lib/hr/cycles";
import { holdingPercent } from "@/lib/hr/share-pool";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { DetailCard, DetailRow } from "@/components/admin/ui/detail";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { employeeOrRedirect } from "../_shared";

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

type PayoutRow = {
  id: string;
  paidOn: string;
  period: string;
  amount: string;
  how: string;
};

const METHOD_LABEL: Record<string, string> = {
  bank: "Bank transfer",
  cash: "Cash",
  cheque: "Cheque",
  mobile: "Mobile wallet",
  other: "Other",
};

const schemeLabel = (line: Payslip["line"], pool: number | null) =>
  line.payScheme === "revenue_share"
    ? typeof line.shares === "number"
      ? `${line.shares.toLocaleString("en-BD")} shares${pool ? ` · ${holdingPercent(line.shares, pool)}% of the pool` : ""}`
      : "Shareholder"
    : line.payScheme === "fixed"
      ? "Fixed salary"
      : "—";

const day = (d?: Date | null) => (d ? formatDay(dayOf(new Date(d))) : "");

/**
 * Only my own figures: my line of each approved profit period, and every
 * payout made to me — never the run itself, nor anyone else's.
 */
export default async function MyPayslipsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await employeeOrRedirect(locale, "/admin/me/payslips");
  const [{ approved, estimate }, payouts, next] = await Promise.all([
    myPayslips(session),
    myPayouts(session),
    myNextPayout(session),
  ]);

  const rows: Row[] = approved.map((p) => ({
    month: p.month,
    label: labelOfKey(p.month),
    scheme: schemeLabel(p.line, p.poolShares),
    amount: formatBDT(p.line.amountMinor, "en"),
    reimbursements:
      p.reimbursementMinor > 0 ? formatBDT(p.reimbursementMinor, "en") : "—",
    paid: p.line.paidAt ? day(p.line.paidAt) : "Not yet",
    status: "approved",
  }));

  const payoutRows: PayoutRow[] = payouts.map((p) => ({
    id: String(p._id),
    paidOn: day(p.paidAt),
    period: `${p.periodLabel}${p.early ? " (early)" : ""}`,
    amount: formatBDT(p.totalMinor, "en"),
    how: [METHOD_LABEL[p.method] ?? p.method, p.reference]
      .filter(Boolean)
      .join(" · "),
  }));

  const columns: Column<Row>[] = [
    {
      key: "month",
      header: "Period",
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
          <StatusBadge tone="warning">With next payout</StatusBadge>
        ) : (
          <span className="text-muted-foreground">{r.paid}</span>
        ),
    },
  ];

  const payoutColumns: Column<PayoutRow>[] = [
    {
      key: "paidOn",
      header: "Paid on",
      cell: (r) => <span className="font-medium">{r.paidOn}</span>,
    },
    {
      key: "period",
      header: "For",
      mobile: "meta",
      cell: (r) => <span className="text-muted-foreground">{r.period}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      cell: (r) => <span className="font-mono text-xs">{r.amount}</span>,
    },
    {
      key: "how",
      header: "How",
      mobile: "meta",
      cell: (r) => <span className="text-muted-foreground">{r.how}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="My payslips"
        description="Your own line of each approved profit period, and every payout made to you. Nothing else is shown here."
      />
      {next && (
        <DetailCard
          title={`Next payout · ${next.schedule.name}`}
          description="What you have earned and not yet been paid. It becomes final when it is paid."
          action={
            <StatusBadge tone="info">
              Payday {formatDay(next.payday)}
            </StatusBadge>
          }
        >
          <DetailRow label="This pay period">
            {periodLabel(next.period.start, next.period.end)}
          </DetailRow>
          <DetailRow label="Earned so far" mono>
            {formatBDT(next.accruedMinor, "en")}
          </DetailRow>
        </DetailCard>
      )}
      {estimate && (
        <DetailCard
          title={`${labelOfKey(estimate.month)} — open period`}
          description="An estimate of your share from this period's figures so far. It becomes final when the office approves the period."
          action={<StatusBadge tone="info">Estimate</StatusBadge>}
        >
          <DetailRow label="Basis">
            {schemeLabel(estimate.line, estimate.poolShares)}
          </DetailRow>
          <DetailRow label="Share so far" mono>
            {formatBDT(estimate.line.amountMinor, "en")}
          </DetailRow>
        </DetailCard>
      )}
      <SectionCard title="Payouts" bodyClassName="p-0">
        <DataTable
          columns={payoutColumns}
          rows={payoutRows}
          getRowKey={(r) => r.id}
          empty="No payout has been made to you yet."
          minWidth={560}
          className="rounded-none border-0"
        />
      </SectionCard>
      <SectionCard title="Shares by profit period" bodyClassName="p-0">
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.month}
          empty="No approved profit period includes you yet."
          minWidth={640}
          className="rounded-none border-0"
        />
      </SectionCard>
    </div>
  );
}
