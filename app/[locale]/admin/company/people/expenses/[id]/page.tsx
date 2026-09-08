import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Paperclip } from "lucide-react";
import {
  getExpenseById,
  getVisitById,
  employeeNames,
} from "@/lib/repositories/expenses.repo";
import { EditorHeader } from "@/components/admin/ui/form-shell";
import {
  DetailLayout,
  DetailCard,
  DetailRow,
} from "@/components/admin/ui/detail";
import { StatusBadge, statusTone } from "@/components/admin/ui/status-badge";
import { ExpenseActions } from "@/components/admin/hr/expense-actions";
import { Button } from "@/components/ui/button";
import { formatBDT } from "@/lib/money";
import { monthLabel, isPayrollMonth } from "@/lib/hr/months";

export const dynamic = "force-dynamic";

const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase());

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const expense = await getExpenseById(id).catch(() => null);
  if (!expense) notFound();

  const [names, visit] = await Promise.all([
    employeeNames([String(expense.employeeId)]).catch(() => new Map()),
    expense.visitId
      ? getVisitById(String(expense.visitId)).catch(() => null)
      : Promise.resolve(null),
  ]);

  const who = names.get(String(expense.employeeId))?.name ?? "—";
  const amountLabel = formatBDT(expense.amountMinor, "en");
  const day = (d: Date | string) =>
    new Date(d).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" });

  const monthName =
    expense.payrollMonth && isPayrollMonth(expense.payrollMonth)
      ? monthLabel(expense.payrollMonth)
      : (expense.payrollMonth ?? null);

  return (
    <div className="space-y-5">
      <EditorHeader
        backHref="/admin/company/people/expenses"
        backLabel="Expenses"
        title={expense.description}
        subtitle={`${expense.ref} · ${amountLabel} · ${who}`}
        action={
          expense.status === "submitted" ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/company/people/expenses/${id}/edit`}>
                Edit
              </Link>
            </Button>
          ) : undefined
        }
      />

      <DetailLayout
        aside={
          <>
            <DetailCard
              title="Claim"
              action={
                <StatusBadge tone={statusTone(expense.status)}>
                  {cap(expense.status)}
                </StatusBadge>
              }
            >
              <DetailRow label="Amount">
                <span className="font-semibold tabular-nums">
                  {amountLabel}
                </span>
              </DetailRow>
              <DetailRow label="Paid by">{who}</DetailRow>
              <DetailRow label="Category">{cap(expense.category)}</DetailRow>
              <DetailRow label="Date spent">{day(expense.spentAt)}</DetailRow>
              <DetailRow label="Visit">
                {visit ? (
                  <Link
                    href={`/admin/company/people/visits/${String(visit._id)}`}
                    className="text-primary hover:underline"
                  >
                    {visit.purpose}
                  </Link>
                ) : (
                  "Not on a visit"
                )}
              </DetailRow>
              <DetailRow label="Settlement">
                {expense.settlement === "payroll"
                  ? `With the ${monthName ?? ""} payroll`
                  : expense.settlement === "direct"
                    ? "Direct payout"
                    : "Not decided"}
              </DetailRow>
              {expense.receiptDocumentId && (
                <DetailRow label="Receipt">
                  <a
                    href={`/api/media/company-document/${String(expense.receiptDocumentId)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary inline-flex items-center gap-1.5 hover:underline"
                  >
                    <Paperclip className="size-3.5" aria-hidden />
                    View receipt
                  </a>
                </DetailRow>
              )}
            </DetailCard>

            <ExpenseActions
              id={id}
              status={expense.status}
              settlement={expense.settlement ?? null}
              payrollMonth={monthName}
              amountLabel={amountLabel}
            />
          </>
        }
      >
        <DetailCard
          title="History"
          description="Every decision on this claim, with who made it."
        >
          {expense.activity.length === 0 ? (
            <p className="text-muted-foreground">Nothing recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {[...expense.activity]
                .sort(
                  (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
                )
                .map((a, i) => (
                  <li key={i} className="flex gap-3">
                    <span
                      aria-hidden
                      className="bg-border mt-1.5 size-1.5 shrink-0 rounded-full"
                    />
                    <span className="min-w-0">
                      <span className="block">{a.body}</span>
                      <span className="text-muted-foreground text-admin-xs block">
                        {new Date(a.at).toLocaleString("en-GB", {
                          timeZone: "Asia/Dhaka",
                        })}
                      </span>
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </DetailCard>

        {expense.rejectionReason && (
          <DetailCard title="Why it was rejected">
            <p>{expense.rejectionReason}</p>
          </DetailCard>
        )}
      </DetailLayout>
    </div>
  );
}
