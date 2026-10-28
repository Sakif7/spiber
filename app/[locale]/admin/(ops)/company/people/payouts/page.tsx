import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { listEmployees } from "@/lib/services/hr/employee.service";
import {
  currentCycle,
  DEFAULT_SCHEDULE_REF,
  describeSchedule,
  listSchedules,
  paydayOf,
  peopleCounts,
  scheduleFloor,
  type ScheduleView,
} from "@/lib/services/hr/pay-schedule.service";
import { listPayouts, scheduleBoard } from "@/lib/services/hr/payout.service";
import {
  addDays,
  dayOf,
  describeCycle,
  formatDay,
  labelOfKey,
  periodAt,
  periodLabel,
  recentPeriods,
  todayKey,
} from "@/lib/hr/cycles";
import { formatBDT } from "@/lib/money";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { SectionCard } from "@/components/admin/ui/section-card";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import {
  PaySchedulesCard,
  type ScheduleRow,
} from "@/components/admin/hr/pay-schedules-card";
import {
  PayoutBoard,
  type BoardView,
} from "@/components/admin/hr/payout-board";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const day = (d?: Date | null) => (d ? formatDay(dayOf(new Date(d))) : "—");

const METHOD_LABEL: Record<string, string> = {
  bank: "Bank transfer",
  cash: "Cash",
  cheque: "Cheque",
  mobile: "Mobile wallet",
  other: "Other",
};

type RecentRow = {
  id: string;
  ref: string;
  name: string;
  period: string;
  amount: string;
  how: string;
  paidOn: string;
  status: string;
};

/**
 * Payouts: when people get the money.
 *
 * Pay schedules on top (each person is on one), then one pay period of one
 * schedule — who is owed what, and the button that records paying them —
 * then everything paid lately. `?schedule=` and `?period=` pick the board;
 * it opens on the default schedule's newest period that has ended.
 */
export default async function PayoutsPage({
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
  const asked = typeof sp.schedule === "string" ? sp.schedule : null;
  const askedPeriod = typeof sp.period === "string" ? sp.period : null;
  const today = todayKey();

  const [schedules, employees, recent] = await Promise.all([
    listSchedules(),
    listEmployees().catch(() => []),
    listPayouts({ limit: 30 }).catch(() => []),
  ]);
  const counts = await peopleCounts(schedules);
  const selected: ScheduleView =
    schedules.find((s) => s.id === asked) ??
    schedules.find((s) => s.isDefault) ??
    schedules[0]!;
  const boardRes = await scheduleBoard(
    selected.virtual ? DEFAULT_SCHEDULE_REF : selected.id,
    askedPeriod,
  );

  const scheduleName = (id: unknown) => {
    const s = id
      ? schedules.find((x) => x.id === String(id))
      : schedules.find((x) => x.isDefault);
    return (s ?? schedules.find((x) => x.isDefault))?.name ?? "Default";
  };
  const onSchedule = (s: ScheduleView, e: { payScheduleId?: unknown }) =>
    e.payScheduleId ? String(e.payScheduleId) === s.id : s.isDefault;

  const rows: ScheduleRow[] = await Promise.all(
    schedules.map(async (s) => {
      const period = periodAt(s.versions, today);
      const floor = s.virtual ? null : await scheduleFloor(s.id);
      const upcoming = s.versions.find((v) => v.from > today);
      return {
        ref: s.virtual ? DEFAULT_SCHEDULE_REF : s.id,
        name: s.name,
        description: s.description,
        cycleLabel: describeSchedule(s, today),
        planned: upcoming
          ? `From ${formatDay(upcoming.from)}: ${describeCycle(upcoming.cycle).toLowerCase()}`
          : null,
        currentPeriod: periodLabel(period.start, period.end),
        payday: formatDay(paydayOf(s, period)),
        people: counts.get(s.id) ?? 0,
        isDefault: s.isDefault,
        virtual: s.virtual,
        cycle: currentCycle(s, today),
        paydayOffsetDays: s.paydayOffsetDays,
        floor,
        suggestedFrom: floor && floor > period.start ? floor : period.start,
        memberIds: employees
          .filter((e) => onSchedule(s, e))
          .map((e) => String(e._id)),
      };
    }),
  );

  const board: BoardView | null = boardRes.ok
    ? {
        schedule: selected.virtual ? DEFAULT_SCHEDULE_REF : selected.id,
        scheduleName: selected.name,
        periodKey: boardRes.data.period.key,
        periodLabel: labelOfKey(boardRes.data.period.key),
        state: boardRes.data.state,
        lastDay: formatDay(addDays(boardRes.data.period.end, -1)),
        payday: formatDay(boardRes.data.payday),
        today,
        rows: boardRes.data.rows.map((r) => ({
          employeeId: r.employeeId,
          name: r.name,
          designation: r.designation,
          active: r.active,
          items: (r.plan?.items ?? []).map((i) => ({
            kind: i.kind,
            label: i.label,
            amount: formatBDT(i.amountMinor, "en"),
          })),
          total: formatBDT(r.plan?.totalMinor ?? 0, "en"),
          totalMinor: r.plan?.totalMinor ?? 0,
          notes: r.plan?.notes ?? [],
          paid: r.paid.map((p) => ({
            id: String(p._id),
            ref: p.ref,
            total: formatBDT(p.totalMinor, "en"),
            on: day(p.paidAt),
            method: METHOD_LABEL[p.method] ?? p.method,
            reference: p.reference ?? null,
          })),
          bank: r.bank,
        })),
      }
    : null;

  const periods = recentPeriods(selected.versions, today, 8);
  const schedulePath = (s: ScheduleView) =>
    `/admin/company/people/payouts?schedule=${s.virtual ? DEFAULT_SCHEDULE_REF : s.id}`;

  const recentRows: RecentRow[] = recent.map((p) => ({
    id: String(p._id),
    ref: p.ref,
    name: p.name,
    period: `${p.scheduleName} · ${p.periodLabel}${p.early ? " (early)" : ""}`,
    amount: formatBDT(p.totalMinor, "en"),
    how: [METHOD_LABEL[p.method] ?? p.method, p.reference]
      .filter(Boolean)
      .join(" · "),
    paidOn: day(p.paidAt),
    status: p.status,
  }));

  const recentColumns: Column<RecentRow>[] = [
    {
      key: "ref",
      header: "Payout",
      mobile: "primary",
      cell: (r) => (
        <Link
          href={`/admin/company/people/payouts/${r.id}`}
          className="text-primary font-mono text-xs hover:underline"
        >
          {r.ref}
        </Link>
      ),
    },
    {
      key: "name",
      header: "Person",
      mobile: "meta",
      cell: (r) => <span className="font-medium">{r.name}</span>,
    },
    {
      key: "period",
      header: "For",
      mobile: "meta",
      cell: (r) => <span className="text-muted-foreground">{r.period}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      mobile: "meta",
      cell: (r) => <span className="font-medium tabular-nums">{r.amount}</span>,
    },
    {
      key: "how",
      header: "How",
      mobile: "meta",
      cell: (r) => <span className="text-muted-foreground">{r.how}</span>,
    },
    {
      key: "paidOn",
      header: "Paid on",
      mobile: "meta",
      cell: (r) => <span>{r.paidOn}</span>,
    },
    {
      key: "status",
      header: "Status",
      mobile: "meta",
      cell: (r) => (
        <StatusBadge
          tone={
            r.status === "paid"
              ? "success"
              : r.status === "voided"
                ? "neutral"
                : "warning"
          }
        >
          {r.status === "processing" ? "Interrupted" : r.status}
        </StatusBadge>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Payouts"
        description="When people get the money. Each person is on a pay schedule; a payout pays everything they have earned and not yet been paid."
        action={
          <Link
            href="/admin/company/people/payroll"
            className="text-primary text-sm font-medium hover:underline"
          >
            Payroll →
          </Link>
        }
      />

      <PaySchedulesCard
        schedules={rows}
        people={employees.map((e) => ({
          id: String(e._id),
          name: e.name,
          scheduleName: scheduleName(e.payScheduleId),
        }))}
        newSuggestedFrom={periodAt([], today).end}
      />

      <SectionCard title="Pay period">
        <div className="grid gap-3">
          {schedules.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {schedules.map((s) => (
                <Link
                  key={s.id}
                  href={schedulePath(s)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs",
                    s.id === selected.id
                      ? "bg-primary text-primary-foreground border-transparent"
                      : "hover:bg-accent",
                  )}
                >
                  {s.name}
                </Link>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {periods.map((p) => (
              <Link
                key={p.key}
                href={`${schedulePath(selected)}&period=${p.key}`}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs",
                  board && p.key === board.periodKey
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "hover:bg-accent",
                )}
              >
                {labelOfKey(p.key)}
                {p.start <= today && today < p.end && (
                  <span className="ml-1.5 opacity-70">· now</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </SectionCard>

      {board ? (
        <PayoutBoard
          key={`${board.schedule}:${board.periodKey}`}
          board={board}
        />
      ) : (
        <SectionCard title="Pay period">
          <p className="text-muted-foreground text-sm">
            That period is not one of this schedule&apos;s.
          </p>
        </SectionCard>
      )}

      <SectionCard title="Recent payouts" bodyClassName="p-0">
        <DataTable
          columns={recentColumns}
          rows={recentRows}
          getRowKey={(r) => r.id}
          empty="Nobody has been paid through payouts yet."
          minWidth={760}
          className="rounded-none border-0"
        />
      </SectionCard>
    </div>
  );
}
