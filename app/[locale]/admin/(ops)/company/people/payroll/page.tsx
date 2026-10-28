import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/current-user";
import {
  getProfitCycle,
  getRun,
  listRuns,
  profitCycleFloor,
} from "@/lib/services/hr/payroll.service";
import {
  dayOf,
  describeCycle,
  formatDay,
  labelOfKey,
  lastEndedPeriod,
  MONTHLY,
  parsePeriodKey,
  periodAt,
  periodByKey,
  recentPeriods,
  todayKey,
  versionOn,
} from "@/lib/hr/cycles";
import { rateLabel } from "@/lib/hr/payroll-math";
import { formatBDT } from "@/lib/money";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import {
  PayrollView,
  type PayrollViewData,
} from "@/components/admin/hr/payroll-view";
import { ProfitCycleCard } from "@/components/admin/hr/profit-cycle-card";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const day = (d?: Date | null) => (d ? formatDay(dayOf(new Date(d))) : "");

/**
 * Payroll: each profit period's profit, split between the shareholders.
 *
 * Defaults to the LAST period that ended: the one running now is still
 * accruing, so the period a company actually settles is the one that has
 * finished. `?period=` picks another; an old `?month=` link still works and
 * opens the period holding that month's first day.
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
  // Here too, not only in the layout: Next ships a page's payload even when
  // its layout shows the refusal instead.
  if (!(await requireSuperAdmin())) return null;

  const sp = await searchParams;
  const asked =
    typeof sp.period === "string"
      ? sp.period
      : typeof sp.month === "string"
        ? sp.month
        : undefined;

  const [versions, floor] = await Promise.all([
    getProfitCycle(),
    profitCycleFloor(),
  ]);
  const today = todayKey();
  const parsed = asked ? parsePeriodKey(asked) : null;
  const period =
    (asked ? periodByKey(versions, asked) : null) ??
    (parsed ? periodAt(versions, parsed.start) : null) ??
    lastEndedPeriod(versions, today);

  const user = await getSessionUser();
  const actor = { sub: user?.sub ?? "", email: user?.email ?? "" };

  const [run, history] = await Promise.all([
    getRun(period.key, actor).catch(() => null),
    listRuns(24).catch(() => []),
  ]);

  const statusByKey = new Map(history.map((r) => [r.month, r.status]));
  const periods = recentPeriods(versions, today, 12);
  const current = versionOn(versions, today);
  const planned = versions.find((v) => v.from > today) ?? null;
  const running = periodAt(versions, today);
  const suggestedFrom = floor && floor > running.start ? floor : running.start;

  const data: PayrollViewData | null =
    run && run.ok
      ? {
          key: period.key,
          label: labelOfKey(period.key),
          status: run.data.status,
          running: period.end > today && period.start <= today,
          revenue: {
            total: formatBDT(run.data.revenue.totalMinor, "en"),
            online: formatBDT(run.data.revenue.onlineMinor, "en"),
            manual: formatBDT(run.data.revenue.manualMinor, "en"),
          },
          // Absent on a month approved under the percentage scheme.
          pool: run.data.pool
            ? {
                grossProfit: formatBDT(run.data.pool.grossProfitMinor, "en"),
                orderCosts: formatBDT(run.data.pool.orderCostsMinor, "en"),
                expenses: formatBDT(run.data.pool.expensesMinor, "en"),
                ait: formatBDT(run.data.pool.aitMinor, "en"),
                netCash: formatBDT(run.data.pool.netCashMinor, "en"),
                salaries: formatBDT(run.data.pool.salariesMinor, "en"),
                salaryLines: (run.data.pool.salaryLines ?? []).map((s) => ({
                  name: s.name,
                  amount: formatBDT(s.amountMinor, "en"),
                })),
                distributable: formatBDT(
                  run.data.pool.distributableMinor,
                  "en",
                ),
                totalShares: run.data.pool.totalShares,
                allocatedShares: run.data.pool.allocatedShares,
                nothingToSplit: run.data.pool.distributableMinor <= 0,
              }
            : null,
          total: formatBDT(run.data.totalMinor, "en"),
          reimbursements: run.data.reimbursements.map((r) => ({
            employeeId: String(r.employeeId),
            name: r.name,
            amount: formatBDT(r.amountMinor, "en"),
            claims: r.expenseIds.length,
            paid: Boolean(r.paidAt),
          })),
          reimbursementTotal: formatBDT(run.data.reimbursementTotalMinor, "en"),
          grandTotal: formatBDT(run.data.grandTotalMinor, "en"),
          approvedAt: run.data.approvedAt ? day(run.data.approvedAt) : null,
          lines: run.data.lines.map((l) => ({
            employeeId: String(l.employeeId),
            name: l.name,
            designation: l.designation,
            rateLabel:
              typeof l.shares === "number"
                ? `${l.shares.toLocaleString("en-BD")} of ${(l.poolShares ?? 0).toLocaleString("en-BD")} shares`
                : l.rateBp == null
                  ? "fixed"
                  : `${rateLabel(l.rateBp)}%`,
            amount: formatBDT(l.amountMinor, "en"),
            nothingToPay: l.amountMinor <= 0,
            paid: l.paidAt
              ? {
                  on: day(l.paidAt),
                  payoutId: l.payoutId ? String(l.payoutId) : null,
                  reference: l.reference ?? null,
                }
              : null,
          })),
        }
      : null;

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Payroll"
        description="Each period, directors split its cash after AIT, less fixed salaries, in proportion to the shares they hold. They are paid on their pay schedule."
        action={
          <Link
            href="/admin/company/people/payouts"
            className="text-primary text-sm font-medium hover:underline"
          >
            Payouts →
          </Link>
        }
      />

      <ProfitCycleCard
        cycle={current?.cycle ?? MONTHLY}
        description={describeCycle(current?.cycle ?? MONTHLY)}
        since={current ? formatDay(current.from) : null}
        planned={
          planned
            ? `${describeCycle(planned.cycle)} from ${formatDay(planned.from)}`
            : null
        }
        floor={floor}
        suggestedFrom={suggestedFrom}
      />

      <SectionCard title="Period">
        <div className="flex flex-wrap gap-1.5">
          {periods.map((p) => {
            const status = statusByKey.get(p.key);
            return (
              <Link
                key={p.key}
                href={`/admin/company/people/payroll?period=${p.key}`}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs",
                  p.key === period.key
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "hover:bg-accent",
                )}
              >
                {labelOfKey(p.key)}
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
            Could not load this period.
          </p>
        </SectionCard>
      )}

      {history.length > 0 && (
        <SectionCard title="Past runs">
          <div className="grid gap-2">
            {history.map((r) => (
              <Link
                key={r.month}
                href={`/admin/company/people/payroll?period=${r.month}`}
                className="hover:bg-accent flex items-center justify-between gap-3 rounded px-2 py-1.5"
              >
                <span className="font-medium">{labelOfKey(r.month)}</span>
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
