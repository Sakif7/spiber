import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Plus } from "lucide-react";
import {
  getVisitById,
  expensesForVisit,
  employeeNames,
} from "@/lib/repositories/expenses.repo";
import { getSalesLeadById } from "@/lib/repositories/sales.repo";
import { EditorHeader } from "@/components/admin/ui/form-shell";
import {
  DetailLayout,
  DetailCard,
  DetailRow,
} from "@/components/admin/ui/detail";
import { StatusBadge, statusTone } from "@/components/admin/ui/status-badge";
import { Button } from "@/components/ui/button";
import { formatBDT } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function VisitDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const visit = await getVisitById(id).catch(() => null);
  if (!visit) notFound();

  const [claims, names, lead] = await Promise.all([
    expensesForVisit(id).catch(() => []),
    employeeNames(visit.attendees.map(String)).catch(() => new Map()),
    visit.leadId
      ? getSalesLeadById(String(visit.leadId)).catch(() => null)
      : Promise.resolve(null),
  ]);

  const claimNames = await employeeNames(
    claims.map((c) => String(c.employeeId)),
  ).catch(() => new Map());

  const total = claims
    .filter((c) => c.status !== "rejected")
    .reduce((sum, c) => sum + c.amountMinor, 0);

  const day = (d: Date | string) =>
    new Date(d).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" });

  return (
    <div className="space-y-5">
      <EditorHeader
        backHref="/admin/company/people/visits"
        backLabel="Visits"
        title={visit.purpose}
        subtitle={`${visit.ref} · ${day(visit.visitedAt)}`}
        action={
          <Button asChild size="sm" className="gap-1.5">
            <Link
              href={`/admin/company/people/expenses/new?visit=${String(visit._id)}`}
            >
              <Plus className="size-4" />
              Add a cost
            </Link>
          </Button>
        }
      />

      <DetailLayout
        aside={
          <>
            <DetailCard title="The trip">
              <DetailRow label="Date">{day(visit.visitedAt)}</DetailRow>
              <DetailRow label="Organisation">
                {visit.organisation ?? "—"}
              </DetailRow>
              <DetailRow label="Location">{visit.location ?? "—"}</DetailRow>
              <DetailRow label="Who went">
                {visit.attendees
                  .map((a) => names.get(String(a))?.name ?? "—")
                  .join(", ")}
              </DetailRow>
              <DetailRow label="Lead">
                {lead ? (
                  <Link
                    href={`/admin/company/sales/leads/${String(lead._id)}`}
                    className="text-primary hover:underline"
                  >
                    {lead.organisation}
                  </Link>
                ) : (
                  "—"
                )}
              </DetailRow>
            </DetailCard>
            <DetailCard title="Cost of the trip">
              <p className="text-admin-xl font-semibold">
                {formatBDT(total, "en")}
              </p>
              <p className="text-muted-foreground">
                {claims.length} claim{claims.length === 1 ? "" : "s"}, rejected
                ones excluded.
              </p>
            </DetailCard>
          </>
        }
      >
        <DetailCard title="Costs claimed">
          {claims.length === 0 ? (
            <p className="text-muted-foreground">
              Nothing claimed against this visit yet.
            </p>
          ) : (
            <ul className="divide-y">
              {claims.map((c) => (
                <li
                  key={String(c._id)}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                >
                  <span className="min-w-0">
                    <Link
                      href={`/admin/company/people/expenses/${String(c._id)}`}
                      className="text-primary font-medium hover:underline"
                    >
                      {c.description}
                    </Link>
                    <span className="text-muted-foreground text-admin-xs block">
                      {claimNames.get(String(c.employeeId))?.name ?? "—"} ·{" "}
                      {c.category} · {day(c.spentAt)}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <StatusBadge tone={statusTone(c.status)}>
                      {c.status}
                    </StatusBadge>
                    <span className="tabular-nums">
                      {formatBDT(c.amountMinor, "en")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DetailCard>

        {(visit.outcome || visit.notes) && (
          <DetailCard title="Notes">
            {visit.outcome && (
              <DetailRow label="Outcome">{visit.outcome}</DetailRow>
            )}
            {visit.notes && <DetailRow label="Notes">{visit.notes}</DetailRow>}
          </DetailCard>
        )}
      </DetailLayout>
    </div>
  );
}
