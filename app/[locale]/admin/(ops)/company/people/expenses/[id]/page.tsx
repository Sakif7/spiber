import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Paperclip } from "lucide-react";
import {
  getExpenseById,
  getVisitById,
  employeeNames,
  activeEmployeeOptions,
  listVisits,
} from "@/lib/repositories/expenses.repo";
import { getDocumentsByIds } from "@/lib/repositories/company-documents.repo";
import { FormPanelButton } from "@/components/admin/ui/form-panel";
import { ExpenseForm } from "@/components/admin/hr/expense-form";
import { ExpenseLinesCard } from "@/components/admin/hr/expense-lines-card";
import {
  expenseFormLines,
  expenseReceiptIdsOf,
  expenseSpanLabel,
} from "@/lib/hr/expense-lines";
import { EditorHeader } from "@/components/admin/ui/form-shell";
import {
  DetailLayout,
  DetailCard,
  DetailRow,
} from "@/components/admin/ui/detail";
import { StatusBadge, statusTone } from "@/components/admin/ui/status-badge";
import { ExpenseActions } from "@/components/admin/hr/expense-actions";
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

  // A claim can only be edited while it is still awaiting a decision, so the
  // form's data is only loaded when the panel could actually be offered.
  const editable = expense.status === "submitted";
  const receiptIds = expenseReceiptIdsOf(expense);
  const [names, visit, people, visitPage, receiptDocs] = await Promise.all([
    employeeNames([String(expense.employeeId)]).catch(() => new Map()),
    expense.visitId
      ? getVisitById(String(expense.visitId)).catch(() => null)
      : Promise.resolve(null),
    editable ? activeEmployeeOptions().catch(() => []) : Promise.resolve([]),
    editable
      ? listVisits({ pageSize: 100 }).catch(() => null)
      : Promise.resolve(null),
    receiptIds.length
      ? getDocumentsByIds(receiptIds).catch(() => [])
      : Promise.resolve([]),
  ]);
  const titleOf = new Map(receiptDocs.map((d) => [String(d._id), d.title]));
  const receipts = receiptIds.map((rid, i) => ({
    id: rid,
    title:
      titleOf.get(rid) ??
      (receiptIds.length === 1 ? "Receipt" : `Receipt ${i + 1}`),
  }));

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
          editable ? (
            <FormPanelButton
              label="Edit"
              title="Edit claim"
              description={expense.ref}
              variant="outline"
              icon={false}
            >
              <ExpenseForm
                people={people}
                visits={(visitPage?.items ?? []).map((v) => ({
                  id: String(v._id),
                  label: `${day(v.visitedAt)} — ${v.purpose}`,
                }))}
                expense={{
                  id,
                  visitId: expense.visitId ? String(expense.visitId) : "",
                  employeeId: String(expense.employeeId),
                  description: expense.description,
                  lines: expenseFormLines(expense),
                  receipts,
                }}
              />
            </FormPanelButton>
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
              <DetailRow label="Spent">
                {expenseSpanLabel(expense, day)}
              </DetailRow>
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
              {receipts.length > 0 && (
                <DetailRow
                  label={receipts.length === 1 ? "Receipt" : "Receipts"}
                >
                  <span className="grid gap-1">
                    {receipts.map((r) => (
                      <a
                        key={r.id}
                        href={`/api/media/company-document/${r.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary inline-flex min-w-0 items-center gap-1.5 hover:underline"
                      >
                        <Paperclip className="size-3.5 shrink-0" aria-hidden />
                        <span className="truncate">{r.title}</span>
                      </a>
                    ))}
                  </span>
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
        <ExpenseLinesCard claim={expense} formatDay={day} />

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
