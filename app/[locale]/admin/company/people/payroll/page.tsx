import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { getSessionUser } from "@/lib/auth/current-user";
import { getRun, listRuns } from "@/lib/services/hr/payroll.service";
import {
  monthOf,
  monthLabel,
  previousMonth,
  recentMonths,
  isPayrollMonth,
} from "@/lib/hr/months";
import { rateLabel } from "@/lib/hr/payroll-math";
import { formatBDT } from "@/lib/money";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import {
  PayrollView,
  type PayrollViewData,
} from "@/components/admin/hr/payroll-view";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

/**
 * Monthly payroll.
 *
 * Defaults to LAST month: this month is still accruing, so the month a company
 * actually pays out for is the one that has finished.
 */
export default async function PayrollPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sp = await searchParams;
  const requested = typeof sp.month === "string" ? sp.month : undefined;
  const month =
    requested && isPayrollMonth(requested)
      ? requested
      : previousMonth(monthOf(new Date()));

  const user = await getSessionUser();
  const actor = { sub: user?.sub ?? "", email: user?.email ?? "" };

  const [run, history] = await Promise.all([
    getRun(month, actor).catch(() => null),
    listRuns(24).catch(() => []),
  ]);

  const statusByMonth = new Map(history.map((r) => [r.month, r.status]));
  const months = recentMonths(monthOf(new Date()), 12).reverse();

  const data: PayrollViewData | null =
    run && run.ok
      ? {
          month,
          monthLabel: monthLabel(month),
          status: run.data.status,
          revenue: {
            total: formatBDT(run.data.revenue.totalMinor, "en"),
            online: formatBDT(run.data.revenue.onlineMinor, "en"),
            manual: formatBDT(run.data.revenue.manualMinor, "en"),
          },
          total: formatBDT(run.data.totalMinor, "en"),
          reimbursements: run.data.reimbursements.map((r) => ({
            employeeId: String(r.employeeId),
            name: r.name,
            amount: formatBDT(r.amountMinor, "en"),
            claims: r.expenseIds.length,
          })),
          reimbursementTotal: formatBDT(run.data.reimbursementTotalMinor, "en"),
          grandTotal: formatBDT(run.data.grandTotalMinor, "en"),
          approvedAt: run.data.approvedAt
            ? new Date(run.data.approvedAt).toISOString()
            : null,
          lines: run.data.lines.map((l) => ({
            employeeId: String(l.employeeId),
            name: l.name,
            designation: l.designation,
            rateLabel: l.rateBp == null ? "fixed" : `${rateLabel(l.rateBp)}%`,
            amount: formatBDT(l.amountMinor, "en"),
            paidAt: l.paidAt ? new Date(l.paidAt).toISOString() : null,
            reference: l.reference ?? null,
          })),
        }
      : null;

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Payroll"
        description="Directors are paid a share of the month's revenue — website and sales orders together."
      />

      <SectionCard title="Month">
        <div className="flex flex-wrap gap-1.5">
          {months.map((m) => {
            const status = statusByMonth.get(m);
            return (
              <Link
                key={m}
                href={`/admin/company/people/payroll?month=${m}`}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs",
                  m === month
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "hover:bg-accent",
                )}
              >
                {monthLabel(m)}
                {status === "approved" && (
                  <span className="ml-1.5 opacity-70">✓</span>
                )}
              </Link>
            );
          })}
        </div>
      </SectionCard>

      {data ? (
        <PayrollView data={data} />
      ) : (
        <SectionCard title="Payroll">
          <p className="text-muted-foreground text-sm">
            Could not load this month.
          </p>
        </SectionCard>
      )}

      {history.length > 0 && (
        <SectionCard title="Past runs">
          <div className="grid gap-2">
            {history.map((r) => (
              <Link
                key={r.month}
                href={`/admin/company/people/payroll?month=${r.month}`}
                className="hover:bg-accent flex items-center justify-between gap-3 rounded px-2 py-1.5"
              >
                <span className="font-medium">{monthLabel(r.month)}</span>
                <StatusBadge
                  tone={r.status === "approved" ? "success" : "warning"}
                >
                  {r.status === "approved" ? "Approved" : "Draft"}
                </StatusBadge>
                <span>{formatBDT(r.totalMinor, "en")}</span>
              </Link>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
