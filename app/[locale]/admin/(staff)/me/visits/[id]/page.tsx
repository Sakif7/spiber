import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import {
  myClaims,
  myLead,
  myVisit,
  myVisitOptions,
} from "@/lib/services/me.service";
import { activeEmployeeOptions } from "@/lib/repositories/expenses.repo";
import { formatBDT } from "@/lib/money";
import {
  DetailCard,
  DetailLayout,
  DetailMeta,
  DetailRow,
} from "@/components/admin/ui/detail";
import { FormPanelButton } from "@/components/admin/ui/form-panel";
import { ExpenseForm } from "@/components/admin/hr/expense-form";
import { StatusBadge, statusTone } from "@/components/admin/ui/status-badge";
import { employeeOrRedirect, cap, day } from "../../_shared";

export const dynamic = "force-dynamic";

/** One of my visits, with my claims against it and a way to add one. */
export default async function MyVisitPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await employeeOrRedirect(locale, `/admin/me/visits/${id}`);
  const visit = await myVisit(session, id);
  if (!visit) notFound();
  const me = String(session.employee._id);
  const [claims, people, lead, visitOptions] = await Promise.all([
    myClaims(session, { pageSize: 100 }),
    activeEmployeeOptions().catch(() => []),
    visit.leadId
      ? myLead(session, String(visit.leadId))
      : Promise.resolve(null),
    myVisitOptions(session),
  ]);
  const mine = claims.items.filter((c) => String(c.visitId ?? "") === id);
  const names = new Map(people.map((p) => [p.id, p.name]));
  const self = people.filter((p) => p.id === me);

  return (
    <div className="grid gap-6">
      <Link
        href="/admin/me/visits"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="size-4" />
        My visits
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            {visit.purpose}
          </h1>
          <DetailMeta className="mt-1">
            {visit.ref} · {day(visit.visitedAt)}
          </DetailMeta>
        </div>
        <FormPanelButton
          label="New claim"
          title="Claim a cost of this visit"
          description="What you paid on this trip. The office approves it."
        >
          <ExpenseForm
            people={self}
            visits={visitOptions}
            lockedVisitId={id}
            endpoint="/api/admin/me/claims"
            receiptEndpoint="/api/admin/me/claims/receipt"
            afterHref="/admin/me/claims"
          />
        </FormPanelButton>
      </div>

      <DetailLayout
        aside={
          <DetailCard title="Who went">
            <ul className="grid gap-1">
              {visit.attendees.map((a) => (
                <li key={String(a)}>
                  {String(a) === me ? "You" : (names.get(String(a)) ?? "—")}
                </li>
              ))}
            </ul>
          </DetailCard>
        }
      >
        <DetailCard title="The trip">
          <DetailRow label="Organisation">
            {visit.organisation ?? "—"}
          </DetailRow>
          <DetailRow label="Location">{visit.location ?? "—"}</DetailRow>
          <DetailRow label="Lead">
            {lead ? (
              <Link
                href={`/admin/me/leads/${String(lead._id)}`}
                className="text-primary hover:underline"
              >
                {lead.organisation}
              </Link>
            ) : (
              "—"
            )}
          </DetailRow>
          {visit.outcome && (
            <DetailRow label="Outcome">{visit.outcome}</DetailRow>
          )}
          {visit.notes && <DetailRow label="Notes">{visit.notes}</DetailRow>}
        </DetailCard>

        <DetailCard
          title="My claims on this visit"
          description={
            mine.length === 0
              ? "Nothing claimed yet."
              : `${formatBDT(
                  mine.reduce((n, c) => n + c.amountMinor, 0),
                  "en",
                )} in ${mine.length} claim${mine.length === 1 ? "" : "s"}.`
          }
        >
          {mine.length > 0 && (
            <ul className="divide-border grid divide-y">
              {mine.map((c) => (
                <li
                  key={String(c._id)}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <Link
                    href={`/admin/me/claims/${String(c._id)}`}
                    className="text-primary hover:underline"
                  >
                    {c.description}
                  </Link>
                  <StatusBadge tone={statusTone(c.status)}>
                    {cap(c.status)}
                  </StatusBadge>
                  <span className="font-mono text-xs">
                    {formatBDT(c.amountMinor, "en")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DetailCard>
      </DetailLayout>
    </div>
  );
}
