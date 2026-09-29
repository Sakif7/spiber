import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { myClaim, myVisit } from "@/lib/services/me.service";
import { formatBDT } from "@/lib/money";
import { expenseReceiptIdsOf, expenseSpanLabel } from "@/lib/hr/expense-lines";
import { ExpenseLinesCard } from "@/components/admin/hr/expense-lines-card";
import {
  DetailCard,
  DetailLayout,
  DetailMeta,
  DetailRow,
} from "@/components/admin/ui/detail";
import { StatusBadge, statusTone } from "@/components/admin/ui/status-badge";
import { employeeOrRedirect, cap, day } from "../../_shared";

export const dynamic = "force-dynamic";

/** One of my claims: what I asked for, and what the office did with it. */
export default async function MyClaimPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await employeeOrRedirect(locale, `/admin/me/claims/${id}`);
  const claim = await myClaim(session, id);
  if (!claim) notFound();
  const visit = claim.visitId
    ? await myVisit(session, String(claim.visitId))
    : null;
  const receiptCount = expenseReceiptIdsOf(claim).length;

  return (
    <div className="grid gap-6">
      <Link
        href="/admin/me/claims"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="size-4" />
        My claims
      </Link>
      <div>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">
          {claim.description}
        </h1>
        <DetailMeta className="mt-1">
          {claim.ref} · {formatBDT(claim.amountMinor, "en")}
        </DetailMeta>
      </div>

      <DetailLayout
        aside={
          <DetailCard title="Where it stands">
            <DetailRow label="Status">
              <StatusBadge tone={statusTone(claim.status)}>
                {cap(claim.status)}
              </StatusBadge>
            </DetailRow>
            {claim.status === "approved" && (
              <DetailRow label="Paid back">
                {claim.settlement === "payroll"
                  ? `With ${claim.payrollMonth ?? "payroll"}`
                  : "Directly"}
              </DetailRow>
            )}
            {claim.status === "rejected" && claim.rejectionReason && (
              <DetailRow label="Reason">{claim.rejectionReason}</DetailRow>
            )}
            {claim.reimbursedAt && (
              <DetailRow label="Reimbursed">
                {day(claim.reimbursedAt)}
              </DetailRow>
            )}
            {claim.payout?.reference && (
              <DetailRow label="Reference" mono>
                {claim.payout.reference}
              </DetailRow>
            )}
          </DetailCard>
        }
      >
        <DetailCard title="The claim">
          <DetailRow label="Amount" mono>
            {formatBDT(claim.amountMinor, "en")}
          </DetailRow>
          <DetailRow label="Spent on">{expenseSpanLabel(claim, day)}</DetailRow>
          <DetailRow label="Visit">
            {visit ? (
              <Link
                href={`/admin/me/visits/${String(visit._id)}`}
                className="text-primary hover:underline"
              >
                {visit.purpose}
              </Link>
            ) : (
              "—"
            )}
          </DetailRow>
          <DetailRow label="Receipts">
            {receiptCount === 0
              ? "None attached"
              : receiptCount === 1
                ? "1 filed in the vault"
                : `${receiptCount} filed in the vault`}
          </DetailRow>
        </DetailCard>

        <ExpenseLinesCard claim={claim} formatDay={day} />

        <DetailCard title="History">
          <ul className="grid gap-2 text-sm">
            {[...claim.activity]
              .sort(
                (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
              )
              .map((a, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[6rem_minmax(0,1fr)] gap-3"
                >
                  <span className="text-muted-foreground font-mono text-xs whitespace-nowrap">
                    {day(a.at)}
                  </span>
                  <span className="min-w-0 break-words">{a.body}</span>
                </li>
              ))}
          </ul>
        </DetailCard>
      </DetailLayout>
    </div>
  );
}
