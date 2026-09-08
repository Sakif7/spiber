import { setRequestLocale } from "next-intl/server";
import { EditorHeader } from "@/components/admin/ui/form-shell";
import { VisitForm } from "@/components/admin/hr/visit-form";
import { activeEmployeeOptions } from "@/lib/repositories/expenses.repo";
import { listSalesLeads } from "@/lib/repositories/sales.repo";

export const dynamic = "force-dynamic";

export default async function NewVisitPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [people, leads] = await Promise.all([
    activeEmployeeOptions().catch(() => []),
    listSalesLeads({ pageSize: 100 }).catch(() => null),
  ]);

  return (
    <div className="space-y-5">
      <EditorHeader
        backHref="/admin/company/people/visits"
        backLabel="Visits"
        title="Record a visit"
        subtitle="A trip out, and who went on it."
      />
      <VisitForm
        people={people}
        leads={(leads?.items ?? []).map((l) => ({
          id: String(l._id),
          label: `${l.organisation} (${l.code})`,
        }))}
      />
    </div>
  );
}
