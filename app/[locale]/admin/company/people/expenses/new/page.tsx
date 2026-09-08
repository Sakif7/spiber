import { setRequestLocale } from "next-intl/server";
import { EditorHeader } from "@/components/admin/ui/form-shell";
import { ExpenseForm } from "@/components/admin/hr/expense-form";
import {
  activeEmployeeOptions,
  listVisits,
} from "@/lib/repositories/expenses.repo";

export const dynamic = "force-dynamic";

export default async function NewExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const visitId = typeof sp.visit === "string" ? sp.visit : undefined;

  const [people, visits] = await Promise.all([
    activeEmployeeOptions().catch(() => []),
    listVisits({ pageSize: 100 }).catch(() => null),
  ]);

  const day = (d: Date | string) =>
    new Date(d).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" });

  return (
    <div className="space-y-5">
      <EditorHeader
        backHref={
          visitId
            ? `/admin/company/people/visits/${visitId}`
            : "/admin/company/people/expenses"
        }
        backLabel={visitId ? "Visit" : "Expenses"}
        title="Record a cost"
        subtitle="What was spent, by whom, and what for."
      />
      <ExpenseForm
        people={people}
        lockedVisitId={visitId}
        visits={(visits?.items ?? []).map((v) => ({
          id: String(v._id),
          label: `${day(v.visitedAt)} — ${v.purpose}`,
        }))}
      />
    </div>
  );
}
