import { connectToDatabase } from "@/lib/db/connect";
import {
  PayrollRun,
  type IPayrollRun,
  type IPayrollLine,
  type IPayrollPool,
  type IPayrollSalaryLine,
} from "@/lib/models/payrollRun";
import { Employee } from "@/lib/models/employee";
import type { Lean } from "@/lib/models/_shared";
import { revenueBetween } from "@/lib/repositories/revenue.repo";
import { salesReport } from "@/lib/repositories/sales-report.repo";
import { getSetting, setSetting } from "@/lib/repositories/settings.repo";
import {
  canStartOn,
  cycleError,
  dayOf,
  lastEndedPeriod,
  monthSegments,
  normalizeVersions,
  periodAt,
  periodByKey,
  periodWindow,
  salaryBetween,
  todayKey,
  withVersion,
  type CycleVersion,
  type DayKey,
  type Period,
} from "@/lib/hr/cycles";
import {
  distributablePool,
  shareOfPool,
  shareOfRevenue,
  weightedShareOfPool,
  weightedShares,
} from "@/lib/hr/payroll-math";
import type { CycleChangeInput } from "@/lib/schemas/hr";
import { getSharePool, holdingForMonth } from "./employee.service";
import { unsettleReimbursementsFor } from "./expense.service";

/**
 * Payroll: each profit period's profit, split between the shareholders.
 *
 * A period starts from the sales report's cash after AIT — the same figure the
 * report shows, online and offline together, counted when the money landed.
 * Fixed salaries earned in the period come off that, and what is left is split
 * between the directors in proportion to the shares they hold. Each period
 * stands alone: one that does not cover its salaries splits nothing and owes
 * nothing, so a longer profit cycle is how good months cover bad ones.
 *
 * The profit cycle (Settings `hr.profitCycle`) decides how long a period is;
 * calendar months until it is changed. While a period is a draft it
 * recomputes on every read, because money for it is still arriving. Approving
 * it freezes everything, so a late payment or a changed holding cannot alter
 * a period the directors were already paid for.
 *
 * Nothing here moves money. People are paid by payouts, on their own pay
 * schedules (`payout.service.ts`), which take the lines of approved periods.
 */

export type Actor = { sub: string; email: string };

export const PROFIT_CYCLE_KEY = "hr.profitCycle";

/**
 * A period as the UI sees it.
 *
 * Optional `_id`, because a period nobody has worked on is computed on the fly
 * and never stored — pretending it were a saved document would be a lie the
 * type system should not tell.
 */
export type PayrollRunView = Omit<Lean<IPayrollRun>, "_id"> & {
  _id?: Lean<IPayrollRun>["_id"];
};

export type PayrollError =
  | "bad_month"
  | "not_found"
  | "already_approved"
  | "not_approved"
  | "has_paid_lines"
  | "bad_cycle"
  /** A new profit cycle would cut into a period already on record. */
  | "cycle_locked";

export type PayrollResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: PayrollError };

const fail = (code: PayrollError): PayrollResult<never> => ({
  ok: false,
  code,
});
const done = <T>(data: T): PayrollResult<T> => ({ ok: true, data });

/**
 * Fill in the reimbursement fields on a stored run.
 *
 * `.lean()` skips Mongoose defaults, so a month approved before these fields
 * existed reads back without them — and the page mapping them would throw.
 */
function withReimbursements(run: Lean<IPayrollRun>): Lean<IPayrollRun> {
  const reimbursements = run.reimbursements ?? [];
  const reimbursementTotalMinor =
    run.reimbursementTotalMinor ??
    reimbursements.reduce((sum, r) => sum + r.amountMinor, 0);
  return {
    ...run,
    reimbursements,
    reimbursementTotalMinor,
    grandTotalMinor:
      run.grandTotalMinor ?? run.totalMinor + reimbursementTotalMinor,
  };
}

/** Was this person on the payroll during the window? */
export function employedDuring(
  e: { joinedAt: Date; leftAt?: Date | null },
  window: { start: Date; end: Date },
): boolean {
  if (new Date(e.joinedAt) >= window.end) return false;
  if (e.leftAt && new Date(e.leftAt) < window.start) return false;
  return true;
}

/** The days someone was employed, for counting a salary by the day. */
export function employment(e: { joinedAt: Date; leftAt?: Date | null }): {
  from: DayKey;
  to: DayKey | null;
} {
  return {
    from: dayOf(new Date(e.joinedAt)),
    to: e.leftAt ? dayOf(new Date(e.leftAt)) : null,
  };
}

// ───────────────────────────── the profit cycle ─────────────────────────────

/** The profit cycle's versions, oldest first; none means calendar months. */
export async function getProfitCycle(): Promise<CycleVersion[]> {
  const stored = await getSetting<{ versions?: unknown }>(
    PROFIT_CYCLE_KEY,
  ).catch(() => null);
  return normalizeVersions(stored?.versions);
}

/**
 * The first day a new profit cycle may begin: the end of the latest period on
 * record, approved or reopened. A period someone has worked on is never re-cut.
 */
export async function profitCycleFloor(): Promise<DayKey | null> {
  await connectToDatabase();
  const last = await PayrollRun.findOne({})
    .sort({ "revenue.windowEnd": -1 })
    .select({ "revenue.windowEnd": 1 })
    .lean<{ revenue?: { windowEnd?: Date } } | null>()
    .exec();
  return last?.revenue?.windowEnd
    ? dayOf(new Date(last.revenue.windowEnd))
    : null;
}

/**
 * Change how often profit is worked out, from a day. Periods before that day
 * keep the cycle they had; a change already planned for later is replaced.
 */
export async function setProfitCycle(
  change: CycleChangeInput,
): Promise<PayrollResult<CycleVersion[]>> {
  if (cycleError(change.cycle) || !canStartOn(change.cycle, change.from)) {
    return fail("bad_cycle");
  }
  const floor = await profitCycleFloor();
  if (floor && change.from < floor) return fail("cycle_locked");
  const versions = withVersion(await getProfitCycle(), change);
  await setSetting(PROFIT_CYCLE_KEY, { versions });
  return done(versions);
}

/** The profit period a key names, or null when it is not one. */
export async function resolveProfitPeriod(key: string): Promise<Period | null> {
  return periodByKey(await getProfitCycle(), key);
}

/** The profit period running today. */
export async function currentProfitPeriod(now = new Date()): Promise<Period> {
  return periodAt(await getProfitCycle(), todayKey(now));
}

/** The newest profit period that has ended — the one waiting to be approved. */
export async function lastEndedProfitPeriod(now = new Date()): Promise<Period> {
  return lastEndedPeriod(await getProfitCycle(), todayKey(now));
}

// ───────────────────────────── computing a period ─────────────────────────────

export type ComputedPeriod = {
  period: Period;
  revenue: Awaited<ReturnType<typeof revenueBetween>>;
  pool: IPayrollPool;
  window: { start: Date; end: Date };
  /** Shares only: salaries are a deduction here, paid by payouts. */
  lines: IPayrollLine[];
  totalMinor: number;
};

/**
 * Work out what a period owes, from live data.
 *
 * Pure in the sense that matters: it reads and calculates, and does not decide
 * whether to store the result.
 */
export async function computePeriod(
  key: string,
): Promise<PayrollResult<ComputedPeriod>> {
  const period = await resolveProfitPeriod(key);
  if (!period) return fail("bad_month");
  return done(await computeFor(period));
}

async function computeFor(period: Period): Promise<ComputedPeriod> {
  await connectToDatabase();
  const window = periodWindow(period);
  const [revenue, report, sharePool, employees] = await Promise.all([
    revenueBetween(window.start, window.end),
    salesReport({ start: window.start, end: window.end }),
    getSharePool(),
    Employee.find({ deletedAt: null, status: "active" })
      .sort({ name: 1 })
      .lean<
        {
          _id: unknown;
          code: string;
          name: string;
          designation: string;
          payScheme: string;
          fixedMonthlyMinor?: number | null;
          joinedAt: Date;
          leftAt?: Date | null;
        }[]
      >()
      .exec(),
  ]);

  const onPayroll = employees.filter((e) => employedDuring(e, window));

  // Salaries first: they are a bill, and they come off before anyone's share.
  // Counted by the day, so the period deducts exactly what the payouts pay
  // for the same days, however either is cut.
  const salaryLines: IPayrollSalaryLine[] = [];
  for (const e of onPayroll) {
    if (e.payScheme !== "fixed" || !e.fixedMonthlyMinor) continue;
    const amountMinor = salaryBetween(
      e.fixedMonthlyMinor,
      period.start,
      period.end,
      employment(e),
    );
    if (amountMinor > 0) {
      salaryLines.push({
        employeeId: String(e._id),
        code: e.code,
        name: e.name,
        amountMinor,
      });
    }
    // payScheme "none" is deliberately not paid through payroll.
  }
  const salariesMinor = salaryLines.reduce((sum, l) => sum + l.amountMinor, 0);

  const t = report.totals;
  const distributableMinor = distributablePool(t.netCashMinor, salariesMinor);
  const pool: IPayrollPool = {
    netCashMinor: t.netCashMinor,
    grossProfitMinor: t.profitMinor,
    orderCostsMinor: t.orderCostMinor,
    expensesMinor: t.expensesMinor,
    aitMinor: t.aitMinor,
    salariesMinor,
    salaryLines,
    distributableMinor,
    totalShares: sharePool.totalShares,
    allocatedShares: 0,
  };

  // Then the directors, each by the holding in force — month by month, since
  // holdings change from a month and a period can span several. No holding
  // at all means not on this period's payroll, which is how a director who
  // joined in March is paid nothing for February.
  const segments = monthSegments(period.start, period.end);
  const lines: IPayrollLine[] = [];
  for (const e of onPayroll) {
    if (e.payScheme !== "revenue_share") continue;
    const holdings = await Promise.all(
      segments.map((s) => holdingForMonth(String(e._id), s.month)),
    );
    if (holdings.every((h) => !h)) continue;
    const base = {
      employeeId: String(e._id),
      code: e.code,
      name: e.name,
      designation: e.designation,
      payScheme: e.payScheme,
    };
    const held = holdings.map((h) => (h && "shares" in h ? h.shares : null));
    if (held.every((s) => s === null)) {
      // A percentage row nobody has migrated: computed the way it was agreed,
      // on revenue, so an old month reads back as it was.
      const legacy = holdings.find((h) => h && "rateBp" in h) as {
        rateBp: number;
      };
      lines.push({
        ...base,
        rateBp: legacy.rateBp,
        amountMinor: shareOfRevenue(revenue.totalMinor, legacy.rateBp),
      });
      continue;
    }
    const pieces = segments.map((s, i) => ({
      days: s.days,
      shares: held[i] ?? 0,
    }));
    const steady = pieces.every((p) => p.shares === pieces[0]!.shares);
    const shares = steady ? pieces[0]!.shares : weightedShares(pieces);
    pool.allocatedShares += shares;
    lines.push({
      ...base,
      shares,
      poolShares: sharePool.totalShares,
      rateBp: null,
      amountMinor: steady
        ? shareOfPool(distributableMinor, shares, sharePool.totalShares)
        : weightedShareOfPool(
            distributableMinor,
            pieces,
            sharePool.totalShares,
          ),
    });
  }

  return {
    period,
    revenue,
    pool,
    window,
    lines,
    totalMinor: lines.reduce((sum, l) => sum + l.amountMinor, 0),
  };
}

/**
 * The period's run: recomputed while it is a draft, returned as stored once it
 * has been approved.
 *
 * Reading a period NEVER creates one. A period nobody has worked on comes back
 * as a transient draft, so browsing through the year does not litter the
 * collection with empty runs; approving is what first commits a period.
 */
export async function getRun(
  key: string,
  actor: Actor,
): Promise<PayrollResult<PayrollRunView>> {
  await connectToDatabase();
  const existing = await PayrollRun.findOne({ month: key })
    .lean<Lean<IPayrollRun>>()
    .exec();
  if (existing?.status === "approved") {
    return done(withReimbursements(existing));
  }

  const period = await resolveProfitPeriod(key);
  if (!period) return fail("bad_month");
  const computed = await computeFor(period);

  // Keep whatever has already been marked paid on a draft line.
  const paidByEmployee = new Map(
    (existing?.lines ?? []).map((l) => [String(l.employeeId), l]),
  );
  const lines = computed.lines.map((l) => {
    const prior = paidByEmployee.get(String(l.employeeId));
    return prior?.paidAt
      ? {
          ...l,
          paidAt: prior.paidAt,
          reference: prior.reference,
          paidBy: prior.paidBy,
          payoutId: prior.payoutId ?? null,
        }
      : l;
  });

  const draft = draftFrom(key, computed, lines, actor);

  // Only refresh a run that is already on record — and never its history,
  // which a reopened period carries ("approved", "reopened: …").
  if (!existing) return done(draft);
  const figures: Partial<PayrollRunView> = { ...draft };
  delete figures.activity;
  delete figures.createdAt;
  delete figures.updatedAt;
  const doc = await PayrollRun.findOneAndUpdate(
    { month: key, status: { $ne: "approved" } },
    { $set: figures },
    { returnDocument: "after" },
  )
    .lean<Lean<IPayrollRun>>()
    .exec();

  return doc ? done(withReimbursements(doc)) : done(draft);
}

/** The shape a computed period takes, stored or not. */
function draftFrom(
  key: string,
  computed: ComputedPeriod,
  lines: IPayrollLine[],
  actor: Actor,
): PayrollRunView {
  return {
    month: key,
    format: 2,
    status: "draft" as const,
    pool: computed.pool,
    lines,
    totalMinor: computed.totalMinor,
    // Claims are paid by payouts now; only a run from before kept them.
    reimbursements: [],
    reimbursementTotalMinor: 0,
    grandTotalMinor: computed.totalMinor,
    revenue: {
      ...computed.revenue,
      windowStart: computed.window.start,
      windowEnd: computed.window.end,
      capturedAt: new Date(),
    },
    generatedAt: new Date(),
    generatedBy: actor.sub,
    approvedAt: null,
    approvedBy: null,
    activity: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/** Freeze the period. Nothing recomputes it afterwards. */
export async function approveRun(
  key: string,
  actor: Actor,
): Promise<PayrollResult<Lean<IPayrollRun>>> {
  await connectToDatabase();

  // Freeze the CURRENT figures, so approving is never a snapshot of stale
  // numbers, and commit the period if this is the first time it is stored.
  const fresh = await getRun(key, actor);
  if (!fresh.ok) return fresh;
  if (fresh.data.status === "approved") return fail("already_approved");

  const doc = await PayrollRun.findOneAndUpdate(
    { month: key, status: { $ne: "approved" } },
    {
      $set: {
        format: 2,
        pool: fresh.data.pool ?? null,
        lines: fresh.data.lines,
        totalMinor: fresh.data.totalMinor,
        reimbursements: [],
        reimbursementTotalMinor: 0,
        grandTotalMinor: fresh.data.totalMinor,
        revenue: fresh.data.revenue,
        status: "approved",
        approvedAt: new Date(),
        approvedBy: actor.sub,
        generatedAt: new Date(),
        generatedBy: actor.sub,
      },
      $setOnInsert: { month: key },
      $push: {
        activity: {
          authorId: actor.sub,
          body: "Payroll approved",
          at: new Date(),
        },
      },
    },
    { upsert: true, returnDocument: "after" },
  )
    .lean<Lean<IPayrollRun>>()
    .exec();
  return doc ? done(doc) : fail("not_found");
}

/**
 * Reopen an approved period.
 *
 * Refused once any line has been paid: the money has left, so the record of
 * what was paid must not become editable. Correct it in a later period
 * instead. The check is part of the write, so a payout landing in the same
 * instant cannot slip past it.
 */
export async function reopenRun(
  key: string,
  reason: string,
  actor: Actor,
): Promise<PayrollResult<Lean<IPayrollRun>>> {
  await connectToDatabase();

  const run = await PayrollRun.findOne({ month: key })
    .lean<Lean<IPayrollRun>>()
    .exec();
  if (!run) return fail("not_found");
  if (run.status !== "approved") return fail("not_approved");
  const paid =
    run.lines.some((l) => l.paidAt) ||
    (run.reimbursements ?? []).some((r) => r.paidAt);
  if (paid) return fail("has_paid_lines");

  const doc = await PayrollRun.findOneAndUpdate(
    {
      month: key,
      status: "approved",
      lines: { $not: { $elemMatch: { paidAt: { $ne: null } } } },
      reimbursements: { $not: { $elemMatch: { paidAt: { $ne: null } } } },
    },
    {
      $set: {
        status: "draft",
        approvedAt: null,
        approvedBy: null,
        reopenedAt: new Date(),
        reopenedBy: actor.sub,
      },
      $push: {
        activity: {
          authorId: actor.sub,
          body: `Reopened: ${reason}`,
          at: new Date(),
        },
      },
    },
    { returnDocument: "after" },
  )
    .lean<Lean<IPayrollRun>>()
    .exec();
  if (!doc) return fail("has_paid_lines");

  // A month from before payouts had settled its claims when it was approved;
  // they go back to waiting — now for the person's next payout.
  await unsettleReimbursementsFor(key, actor);
  return done(doc);
}

/** Past runs, newest first, for the period navigator. */
export async function listRuns(limit = 24): Promise<Lean<IPayrollRun>[]> {
  await connectToDatabase();
  return PayrollRun.find({})
    .sort({ month: -1 })
    .limit(limit)
    .lean<Lean<IPayrollRun>[]>()
    .exec();
}
