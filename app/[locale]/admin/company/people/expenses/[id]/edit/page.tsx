import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { EditorHeader } from "@/components/admin/ui/form-shell";
import { ExpenseForm } from "@/components/admin/hr/expense-form";
import {
  getExpenseById,
  activeEmployeeOptions,
  listVisits,
} from "@/lib/repositories/expenses.repo";
import { getCompanyDocumentById } from "@/lib/repositories/company-documents.repo";

export const dynamic = "force-dynamic";

/** Editing is only offered while a claim is still awaiting a decision. */
export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const expense = await getExpenseById(id).catch(() => null);
  if (!expense || expense.status !== "submitted") notFound();

  const [people, visits, receipt] = await Promise.all([
    activeEmployeeOptions().catch(() => []),
    listVisits({ pageSize: 100 }).catch(() => null),
    expense.receiptDocumentId
      ? getCompanyDocumentById(String(expense.receiptDocumentId)).catch(
          () => null,
        )
      : Promise.resolve(null),
  ]);

  const day = (d: Date | string) =>
    new Date(d).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" });
  const isoDay = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

  return (
    <div className="space-y-5">
      <EditorHeader
        backHref={`/admin/company/people/expenses/${id}`}
        backLabel="Claim"
        title="Edit claim"
        subtitle={expense.ref}
      />
      <ExpenseForm
        people={people}
        visits={(visits?.items ?? []).map((v) => ({
          id: String(v._id),
          label: `${day(v.visitedAt)} — ${v.purpose}`,
        }))}
        expense={{
          id,
          visitId: expense.visitId ? String(expense.visitId) : "",
          employeeId: String(expense.employeeId),
          category: expense.category,
          amount: (expense.amountMinor / 100).toString(),
          spentAt: isoDay(expense.spentAt),
          description: expense.description,
          receiptDocumentId: expense.receiptDocumentId
            ? String(expense.receiptDocumentId)
            : "",
          receiptTitle: receipt?.title ?? "",
        }}
      />
    </div>
  );
}
