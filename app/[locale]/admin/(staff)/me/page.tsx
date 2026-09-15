import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { ChevronRight, MapPin, PenLine, ReceiptText } from "lucide-react";
import { requireEmployee } from "@/lib/auth/guard";
import {
  deskSummary,
  myClaims,
  myLeads,
  myPayslips,
  myVisits,
} from "@/lib/services/me.service";
import { mailboxForEmployee } from "@/lib/services/hr/employee-access.service";
import { givenName } from "@/lib/hr/names";
import { formatBDT } from "@/lib/money";
import { monthLabel } from "@/lib/hr/months";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { DetailCard } from "@/components/admin/ui/detail";
import { StatusBadge, statusTone } from "@/components/admin/ui/status-badge";
import { Button } from "@/components/ui/button";
import { NoEmployeeRecord, cap, day } from "./_shared";

export const dynamic = "force-dynamic";

function Stat({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="bg-card hover:bg-muted/40 flex flex-col gap-1.5 rounded-md border px-4 py-3.5 transition-colors"
    >
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-foreground font-mono text-2xl leading-none font-semibold tracking-tight">
        {value}
      </span>
      <span className="text-muted-foreground text-xs">{hint}</span>
    </Link>
  );
}

/**
 * The employee's home: their numbers, their mail, their leads, their pay —
 * every figure here comes from a query scoped to them (lib/services/me).
 */
export default async function MyDeskPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await requireEmployee();
  if (!session) return <NoEmployeeRecord title="My desk" />;

  const { employee, claims } = session;
  const [summary, mailbox, leads, visits, claimsPage, pay] = await Promise.all([
    deskSummary(session),
    mailboxForEmployee(String(employee._id)),
    myLeads(session, { pageSize: 5 }),
    myVisits(session, { pageSize: 3 }),
    myClaims(session, { pageSize: 3 }),
    myPayslips(session, 1),
  ]);
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const current = pay.estimate ?? pay.approved[0] ?? null;

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title={`${greeting}, ${givenName(employee.name)}`}
        description={[
          employee.designation,
          employee.businessEmail ?? claims.email,
        ].join(" · ")}
        action={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/me/visits">
                <MapPin className="size-4" aria-hidden />
                Record a visit
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/me/claims">
                <ReceiptText className="size-4" aria-hidden />
                New claim
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/admin/me/mail">
                <PenLine className="size-4" aria-hidden />
                Mail
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Unread mail"
          value={summary.unreadMail === null ? "—" : String(summary.unreadMail)}
          hint={mailbox ? mailbox.address : "no mailbox yet"}
          href="/admin/me/mail"
        />
        <Stat
          label="Open leads"
          value={String(summary.openLeads)}
          hint="assigned to you or brought in by you"
          href="/admin/me/leads"
        />
        <Stat
          label="Sales orders in progress"
          value={String(summary.ordersInProgress)}
          hint="not yet delivered"
          href="/admin/me/orders"
        />
        <Stat
          label="Claims awaiting approval"
          value={String(summary.claimsPending)}
          hint={`${summary.visitsThisMonth} visit${summary.visitsThisMonth === 1 ? "" : "s"} this month`}
          href="/admin/me/claims"
        />
      </div>

      {(summary.documentsPending > 0 ||
        summary.reviewsPending > 0 ||
        !employee.signatureAssetId) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {summary.documentsPending > 0 && (
            <Stat
              label="Documents waiting for you"
              value={String(summary.documentsPending)}
              hint="read and acknowledge or sign"
              href="/admin/me/documents"
            />
          )}
          {summary.reviewsPending > 0 && (
            <Stat
              label="Drafts to review"
              value={String(summary.reviewsPending)}
              hint="read and comment"
              href="/admin/me/reviews"
            />
          )}
          {!employee.signatureAssetId && (
            <Stat
              label="Your signature"
              value="Not set"
              hint="add it once; it signs documents sent to you"
              href="/admin/me/signature"
            />
          )}
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid gap-4">
          <DetailCard
            title="My leads"
            description="Only leads assigned to you."
            action={
              <Link
                href="/admin/me/leads"
                className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
              >
                All my leads <ChevronRight className="size-3" aria-hidden />
              </Link>
            }
            bodyClassName="p-0"
          >
            {leads.items.length === 0 ? (
              <p className="text-muted-foreground px-4 py-3">
                No leads assigned to you yet.
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {leads.items.map((l) => (
                  <li
                    key={String(l._id)}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <Link
                        href={`/admin/me/leads/${String(l._id)}`}
                        className="text-primary block truncate font-medium hover:underline"
                      >
                        {l.organisation}
                      </Link>
                      <span className="text-muted-foreground block truncate font-mono text-xs">
                        {l.code}
                      </span>
                    </span>
                    <StatusBadge tone={statusTone(l.status)}>
                      {cap(l.status)}
                    </StatusBadge>
                  </li>
                ))}
              </ul>
            )}
          </DetailCard>
          <DetailCard
            title="Visits & claims"
            action={
              <Link
                href="/admin/me/visits"
                className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
              >
                All visits <ChevronRight className="size-3" aria-hidden />
              </Link>
            }
            bodyClassName="p-0"
          >
            {visits.items.length === 0 && claimsPage.items.length === 0 ? (
              <p className="text-muted-foreground px-4 py-3">
                No visits or claims yet.
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {visits.items.map((v) => (
                  <li
                    key={String(v._id)}
                    className="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-3 px-4 py-2 text-sm"
                  >
                    <span className="text-muted-foreground font-mono text-xs">
                      {day(v.visitedAt).slice(0, 6)}
                    </span>
                    <Link
                      href={`/admin/me/visits/${String(v._id)}`}
                      className="text-primary truncate hover:underline"
                    >
                      {v.organisation ?? v.purpose}
                    </Link>
                  </li>
                ))}
                {claimsPage.items.map((c) => (
                  <li
                    key={String(c._id)}
                    className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 text-sm"
                  >
                    <span className="text-muted-foreground font-mono text-xs">
                      {day(c.spentAt).slice(0, 6)}
                    </span>
                    <Link
                      href={`/admin/me/claims/${String(c._id)}`}
                      className="text-primary truncate hover:underline"
                    >
                      {c.description}
                    </Link>
                    <StatusBadge tone={statusTone(c.status)}>
                      {cap(c.status)}
                    </StatusBadge>
                  </li>
                ))}
              </ul>
            )}
          </DetailCard>
        </div>

        <DetailCard
          title={current ? `My pay · ${monthLabel(current.month)}` : "My pay"}
          description={
            current?.status === "estimate"
              ? "Month still open — final once payroll is approved. Only your own line is shown."
              : current
                ? "Your line of the last approved month."
                : "No payroll month includes you yet."
          }
          action={
            current ? (
              <StatusBadge
                tone={current.status === "estimate" ? "info" : "success"}
              >
                {current.status === "estimate" ? "Open month" : "Approved"}
              </StatusBadge>
            ) : undefined
          }
        >
          {current && (
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Basis</span>
                <span className="text-right">
                  {current.line.payScheme === "revenue_share" &&
                  typeof current.line.shares === "number"
                    ? `${current.line.shares.toLocaleString("en-BD")} of ${(current.poolShares ?? 0).toLocaleString("en-BD")} shares`
                    : cap(current.line.payScheme)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Pay</span>
                <span className="font-mono">
                  {formatBDT(current.line.amountMinor, "en")}
                </span>
              </div>
              {current.reimbursementMinor > 0 && (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">
                    Approved reimbursements
                  </span>
                  <span className="font-mono">
                    {formatBDT(current.reimbursementMinor, "en")}
                  </span>
                </div>
              )}
              <div className="border-border flex justify-between gap-3 border-t pt-2">
                <span className="font-semibold">Total</span>
                <span className="font-mono font-semibold">
                  {formatBDT(
                    current.line.amountMinor + current.reimbursementMinor,
                    "en",
                  )}
                </span>
              </div>
              <Link
                href="/admin/me/payslips"
                className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
              >
                All payslips <ChevronRight className="size-3" aria-hidden />
              </Link>
            </div>
          )}
        </DetailCard>
      </div>
    </div>
  );
}
