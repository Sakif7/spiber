import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, FileText } from "lucide-react";
import {
  getPayout,
  isLatestPayout,
  voidable,
} from "@/lib/services/hr/payout.service";
import { dayOf, formatDay } from "@/lib/hr/cycles";
import { formatBDT } from "@/lib/money";
import { Button } from "@/components/ui/button";
import {
  DetailCard,
  DetailLayout,
  DetailMeta,
  DetailRow,
} from "@/components/admin/ui/detail";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { PayoutVoid } from "@/components/admin/hr/payout-void";

export const dynamic = "force-dynamic";

const day = (d?: Date | null) => (d ? formatDay(dayOf(new Date(d))) : "—");

const KIND_LABEL: Record<string, string> = {
  share: "Share of profit",
  salary: "Salary",
  run_salary: "Salary (month approved before payouts)",
  claims: "Expense claims",
  run_reimbursement: "Claims (month approved before payouts)",
};

const METHOD_LABEL: Record<string, string> = {
  bank: "Bank transfer",
  cash: "Cash",
  cheque: "Cheque",
  mobile: "Mobile wallet",
  other: "Other",
};

/** One payout: what it paid, to whom, how, and what happened to it. */
export default async function PayoutPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const payout = await getPayout(id);
  if (!payout) notFound();
  const latest = await isLatestPayout(payout);
  const canVoid = voidable(payout) && latest;
  const hasSalary = payout.items.some(
    (i) => i.kind === "salary" || i.kind === "run_salary",
  );

  return (
    <div className="grid gap-6">
      <Link
        href="/admin/company/people/payouts"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="size-4" />
        Back to payouts
      </Link>

      <div>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">
          {formatBDT(payout.totalMinor, "en")} to {payout.name}
        </h1>
        <DetailMeta className="mt-1">
          {payout.ref} · {payout.scheduleName} · {payout.periodLabel}
        </DetailMeta>
      </div>

      <DetailLayout
        aside={
          <>
            <DetailCard
              title="Payment"
              action={
                <StatusBadge
                  tone={
                    payout.status === "paid"
                      ? "success"
                      : payout.status === "processing"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {payout.status === "processing"
                    ? "Interrupted"
                    : payout.status}
                </StatusBadge>
              }
            >
              <DetailRow label="Paid on">{day(payout.paidAt)}</DetailRow>
              <DetailRow label="How">
                {METHOD_LABEL[payout.method] ?? payout.method}
              </DetailRow>
              <DetailRow label="Reference" mono>
                {payout.reference || "—"}
              </DetailRow>
              <DetailRow label="Covers">
                {payout.early
                  ? `Earned up to ${day(new Date(payout.upTo.getTime() - 1))} (paid early)`
                  : payout.periodLabel}
              </DetailRow>
              {payout.status === "voided" && (
                <DetailRow label="Voided">
                  {day(payout.voidedAt)} — {payout.voidReason}
                </DetailRow>
              )}
              {hasSalary && payout.status === "paid" && (
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="gap-1.5 justify-self-start"
                >
                  <a
                    href={`/api/admin/company/hr/payouts/${String(payout._id)}/payslip`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <FileText className="size-4" />
                    Salary payslip
                  </a>
                </Button>
              )}
            </DetailCard>
            {payout.bank?.accountNumber && (
              <DetailCard title="Sent to">
                <DetailRow label="Bank">
                  {payout.bank.bankName ?? "—"}
                </DetailRow>
                <DetailRow label="Account">
                  {payout.bank.accountName ?? "—"}
                </DetailRow>
                <DetailRow label="Number" mono>
                  {payout.bank.accountNumber}
                </DetailRow>
              </DetailCard>
            )}
            {canVoid && (
              <PayoutVoid
                id={String(payout._id)}
                interrupted={payout.status === "processing"}
              />
            )}
            {voidable(payout) && !latest && (
              <DetailCard title="Voiding">
                <p className="text-muted-foreground text-sm">
                  A later payout to {payout.name} exists, so this one can only
                  be voided after that one.
                </p>
              </DetailCard>
            )}
          </>
        }
      >
        <DetailCard title="What it paid">
          <ul className="divide-y">
            {payout.items.map((item, n) => (
              <li
                key={n}
                className="flex items-start justify-between gap-4 py-2 first:pt-0"
              >
                <span className="min-w-0">
                  <span className="block font-medium">
                    {KIND_LABEL[item.kind] ?? item.kind}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {item.label}
                    {item.kind === "share" && typeof item.shares === "number"
                      ? ` · ${item.shares.toLocaleString("en-BD")} of ${(item.poolShares ?? 0).toLocaleString("en-BD")} shares`
                      : ""}
                    {item.refs?.length ? ` · ${item.refs.join(", ")}` : ""}
                  </span>
                  {item.runKey && (
                    <Link
                      href={`/admin/company/people/payroll?period=${item.runKey}`}
                      className="text-primary text-xs hover:underline"
                    >
                      Open the profit period
                    </Link>
                  )}
                </span>
                <span className="tabular-nums">
                  {formatBDT(item.amountMinor, "en")}
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-4 pt-2 font-medium">
              <span>Total</span>
              <span className="tabular-nums">
                {formatBDT(payout.totalMinor, "en")}
              </span>
            </li>
          </ul>
        </DetailCard>

        <DetailCard title="History">
          <ul className="grid gap-2 text-sm">
            {[...payout.activity].reverse().map((a, n) => (
              <li key={n} className="flex justify-between gap-4">
                <span>{a.body}</span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {day(a.at)}
                </span>
              </li>
            ))}
          </ul>
        </DetailCard>
      </DetailLayout>
    </div>
  );
}
