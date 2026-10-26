import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import {
  PayrollPayout,
  type IPayrollPayout,
  type IPayoutItem,
} from "@/lib/models/payrollPayout";
import { PayrollRun, type IPayrollRun } from "@/lib/models/payrollRun";
import { Employee, type IEmployee } from "@/lib/models/employee";
import type { Lean } from "@/lib/models/_shared";
import { payrollPayoutRef } from "@/lib/ids";
import { formatBDT } from "@/lib/money";
import {
  addDays,
  dayOf,
  dayStart,
  daysBetween,
  formatDay,
  labelOfKey,
  lastEndedPeriod,
  periodAt,
  periodByKey,
  periodLabel,
  previousPeriod,
  salaryBetween,
  todayKey,
  type DayKey,
  type Period,
} from "@/lib/hr/cycles";
import type { PayoutMethod } from "@/lib/schemas/hr";
import { employment, getProfitCycle } from "./payroll.service";
import {
  claimForPayout,
  payrollClaimsDue,
  releaseFromPayout,
} from "./expense.service";
import {
  ensureDefaultSchedule,
  paydayOf,
  peopleOnSchedule,
  resolveSchedule,
  scheduleForEmployee,
  type ScheduleView,
} from "./pay-schedule.service";

/**
 * Payouts: money handed over, on each person's pay schedule.
 *
 * A payout pays everything someone has earned and not yet been paid up to the
 * end of a pay period: their lines of approved profit periods that have ended
 * by then, their fixed salary by the day, and their approved claims. It is
 * worked out on the server every time — the client only ever says who, for
 * which period, and how the money went.
 *
 * Each item is taken with a conditional update on the record it came from,
 * so the same money cannot be paid twice. The database has no transactions:
 * a payout that finds something already taken hands back what it had taken
 * and records itself as cancelled, and nothing is paid.
 */

export type Actor = { sub: string; email: string };

export type PayoutError =
  | "not_found"
  | "bad_schedule"
  | "bad_period"
  | "period_not_started"
  | "not_on_schedule"
  | "nothing_due"
  /** Something it included was paid or changed while it was being recorded. */
  | "changed"
  | "not_paid"
  /** Only someone's latest payout can be voided. */
  | "not_latest"
  /** The salary pointer moved since; voiding would lose track of days. */
  | "salary_moved"
  /** "Salary paid up to" cannot go back before a payout that paid salary. */
  | "before_payout";

export type PayoutResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: PayoutError };

const fail = (code: PayoutError): PayoutResult<never> => ({
  ok: false,
  code,
});
const done = <T>(data: T): PayoutResult<T> => ({ ok: true, data });

const oid = (v: unknown) => new mongoose.Types.ObjectId(String(v));

/** The fields of a person that a payout reads. */
export type Payee = Pick<
  IEmployee,
  | "code"
  | "name"
  | "designation"
  | "payScheme"
  | "fixedMonthlyMinor"
  | "joinedAt"
  | "leftAt"
  | "status"
  | "salaryPaidThrough"
  | "payScheduleId"
  | "bankDetails"
> & { _id: unknown };

const PAYEE_FIELDS = {
  code: 1,
  name: 1,
  designation: 1,
  payScheme: 1,
  fixedMonthlyMinor: 1,
  joinedAt: 1,
  leftAt: 1,
  status: 1,
  salaryPaidThrough: 1,
  payScheduleId: 1,
  bankDetails: 1,
} as const;

/** What someone is owed up to a day, item by item. */
export type DuePlan = {
  employeeId: string;
  /** Everything earned before this day is in it. */
  upTo: DayKey;
  items: IPayoutItem[];
  totalMinor: number;
  /** What they might expect that this does not include, and why. */
  notes: string[];
};

/**
 * Where someone's unpaid salary starts: the day after their last payout's
 * salary, or — before their first — the end of the last month approved
 * before payouts that already held their salary as a line, or the day they
 * joined.
 */
async function salaryStart(e: Payee): Promise<DayKey> {
  const joined = dayOf(new Date(e.joinedAt));
  if (e.salaryPaidThrough) {
    const through = dayOf(new Date(e.salaryPaidThrough));
    return through > joined ? through : joined;
  }
  const last = await PayrollRun.findOne({
    status: "approved",
    format: { $ne: 2 },
    lines: { $elemMatch: { employeeId: oid(e._id), payScheme: "fixed" } },
  })
    .sort({ "revenue.windowEnd": -1 })
    .select({ "revenue.windowEnd": 1 })
    .lean<{ revenue?: { windowEnd?: Date } } | null>()
    .exec();
  const epoch = last?.revenue?.windowEnd
    ? dayOf(new Date(last.revenue.windowEnd))
    : null;
  return epoch && epoch > joined ? epoch : joined;
}

/** Everything `e` has earned and not been paid, up to (not including) `upTo`. */
export async function dueFor(e: Payee, upTo: DayKey): Promise<DuePlan> {
  await connectToDatabase();
  const employeeId = oid(e._id);
  const mine = (id: unknown) => String(id) === String(employeeId);
  const items: IPayoutItem[] = [];
  const notes: string[] = [];

  // 1. Lines of approved profit periods that ended by then. A run from before
  // payouts also froze the month's claims, which travel with the person's
  // line of that month: settled if the line was marked paid back then.
  const runs = await PayrollRun.find({
    status: "approved",
    "revenue.windowEnd": { $lte: dayStart(upTo) },
    $or: [
      { lines: { $elemMatch: { employeeId, paidAt: null } } },
      { reimbursements: { $elemMatch: { employeeId, paidAt: null } } },
    ],
  })
    .sort({ month: 1 })
    .lean<Lean<IPayrollRun>[]>()
    .exec();
  for (const run of runs) {
    const label = labelOfKey(run.month);
    const legacy = run.format !== 2;
    for (const l of run.lines) {
      // Nothing to hand over for a line of ৳0 — a period that did not clear
      // its salaries, say.
      if (!mine(l.employeeId) || l.paidAt || l.amountMinor <= 0) continue;
      items.push(
        legacy && l.payScheme === "fixed"
          ? {
              kind: "run_salary",
              runKey: run.month,
              label,
              amountMinor: l.amountMinor,
            }
          : {
              kind: "share",
              runKey: run.month,
              label,
              amountMinor: l.amountMinor,
              shares: l.shares ?? null,
              poolShares: l.poolShares ?? null,
              rateBp: l.rateBp ?? null,
            },
      );
    }
    if (legacy) {
      const paidLine = run.lines.some((l) => mine(l.employeeId) && l.paidAt);
      for (const r of run.reimbursements ?? []) {
        if (!mine(r.employeeId) || r.paidAt || paidLine) continue;
        if (r.amountMinor <= 0) continue;
        items.push({
          kind: "run_reimbursement",
          runKey: run.month,
          label,
          amountMinor: r.amountMinor,
          expenseIds: (r.expenseIds ?? []).map(String),
        });
      }
    }
  }

  // 2. Salary, by the day.
  if (e.payScheme === "fixed" && e.fixedMonthlyMinor && e.status === "active") {
    const from = await salaryStart(e);
    const worked = employment(e);
    const afterLeaving = worked.to ? addDays(worked.to, 1) : null;
    const end = afterLeaving && afterLeaving < upTo ? afterLeaving : upTo;
    if (from < end) {
      const amountMinor = salaryBetween(e.fixedMonthlyMinor, from, end, worked);
      if (amountMinor > 0) {
        items.push({
          kind: "salary",
          label: periodLabel(from, end),
          amountMinor,
          from: dayStart(from),
          to: dayStart(end),
          monthlyMinor: e.fixedMonthlyMinor,
          previousThrough: e.salaryPaidThrough ?? null,
        });
        if (daysBetween(from, end) > 62) {
          notes.push(
            `Salary from ${formatDay(from)} — over two months. If they were paid outside the system before, set "Salary paid up to" on their page first.`,
          );
        }
      }
    }
  }

  // 3. Claims approved to be paid with payroll.
  const claims = await payrollClaimsDue(employeeId);
  if (claims.length > 0) {
    items.push({
      kind: "claims",
      label:
        claims.length === 1
          ? "1 expense claim"
          : `${claims.length} expense claims`,
      amountMinor: claims.reduce((n, c) => n + c.amountMinor, 0),
      expenseIds: claims.map((c) => String(c._id)),
      refs: claims.map((c) => c.ref),
    });
  }

  // 4. What a shareholder might expect but this does not include.
  if (e.payScheme === "revenue_share") {
    const versions = await getProfitCycle();
    const holding = periodAt(versions, addDays(upTo, -1));
    const lastEnded =
      holding.end <= upTo ? holding : previousPeriod(versions, holding);
    if (holding.end > upTo) {
      notes.push(
        `Shares for ${labelOfKey(holding.key)} come once that profit period has ended and been approved.`,
      );
    }
    const run = await PayrollRun.findOne({ month: lastEnded.key })
      .select({ status: 1 })
      .lean<{ status: string } | null>()
      .exec();
    if (run?.status !== "approved") {
      notes.push(
        `Profit for ${labelOfKey(lastEnded.key)} is not approved yet, so its shares are not included. Approve it on the Payroll page.`,
      );
    }
  }

  return {
    employeeId: String(employeeId),
    upTo,
    items,
    totalMinor: items.reduce((n, i) => n + i.amountMinor, 0),
    notes,
  };
}

// ───────────────────────────── taking and handing back ─────────────────────────────

async function claimItem(
  item: IPayoutItem,
  payout: { _id: mongoose.Types.ObjectId; ref: string },
  employeeId: mongoose.Types.ObjectId,
  paidAt: Date,
  actor: Actor,
): Promise<boolean> {
  switch (item.kind) {
    case "share":
    case "run_salary": {
      const res = await PayrollRun.updateOne(
        {
          month: item.runKey,
          status: "approved",
          lines: {
            $elemMatch: {
              employeeId,
              paidAt: null,
              amountMinor: item.amountMinor,
            },
          },
        },
        {
          $set: {
            "lines.$.paidAt": paidAt,
            "lines.$.reference": payout.ref,
            "lines.$.paidBy": actor.sub,
            "lines.$.payoutId": payout._id,
          },
        },
      ).exec();
      return res.modifiedCount === 1;
    }
    case "run_reimbursement": {
      const res = await PayrollRun.updateOne(
        {
          month: item.runKey,
          status: "approved",
          reimbursements: { $elemMatch: { employeeId, paidAt: null } },
        },
        {
          $set: {
            "reimbursements.$.paidAt": paidAt,
            "reimbursements.$.payoutId": payout._id,
          },
        },
      ).exec();
      return res.modifiedCount === 1;
    }
    case "salary": {
      const res = await Employee.updateOne(
        { _id: employeeId, salaryPaidThrough: item.previousThrough ?? null },
        { $set: { salaryPaidThrough: item.to } },
      ).exec();
      return res.modifiedCount === 1;
    }
    case "claims":
      return claimForPayout(
        item.expenseIds ?? [],
        payout,
        employeeId,
        paidAt,
        actor,
      );
  }
}

async function releaseItem(
  item: IPayoutItem,
  payout: { _id: mongoose.Types.ObjectId; ref: string },
  employeeId: mongoose.Types.ObjectId,
  actor: Actor,
  why: string,
): Promise<boolean> {
  switch (item.kind) {
    case "share":
    case "run_salary": {
      const res = await PayrollRun.updateOne(
        {
          month: item.runKey,
          lines: { $elemMatch: { employeeId, payoutId: payout._id } },
        },
        {
          $set: {
            "lines.$.paidAt": null,
            "lines.$.reference": null,
            "lines.$.paidBy": null,
            "lines.$.payoutId": null,
          },
        },
      ).exec();
      return res.modifiedCount === 1;
    }
    case "run_reimbursement": {
      const res = await PayrollRun.updateOne(
        {
          month: item.runKey,
          reimbursements: { $elemMatch: { employeeId, payoutId: payout._id } },
        },
        {
          $set: {
            "reimbursements.$.paidAt": null,
            "reimbursements.$.payoutId": null,
          },
        },
      ).exec();
      return res.modifiedCount === 1;
    }
    case "salary": {
      const res = await Employee.updateOne(
        { _id: employeeId, salaryPaidThrough: item.to },
        { $set: { salaryPaidThrough: item.previousThrough ?? null } },
      ).exec();
      return res.modifiedCount === 1;
    }
    case "claims":
      return (await releaseFromPayout(payout, actor, why)) > 0;
  }
}

// ───────────────────────────── paying ─────────────────────────────

export type PayContext = {
  schedule: ScheduleView;
  period: Period;
  upTo: DayKey;
  early: boolean;
  method: PayoutMethod;
  reference?: string | null;
  /** The day the money went. */
  paidOn: DayKey;
};

/** Pay one person everything due up to `ctx.upTo`, as one payout. */
export async function payOne(
  e: Payee,
  ctx: PayContext,
  actor: Actor,
): Promise<PayoutResult<Lean<IPayrollPayout>>> {
  await connectToDatabase();
  const plan = await dueFor(e, ctx.upTo);
  if (plan.items.length === 0 || plan.totalMinor <= 0) {
    return fail("nothing_due");
  }
  const employeeId = oid(e._id);
  const paidAt = dayStart(ctx.paidOn);
  const reference = ctx.reference?.trim() || null;
  const bank = e.bankDetails?.accountNumber
    ? {
        bankName: e.bankDetails.bankName ?? null,
        accountName: e.bankDetails.accountName ?? null,
        accountNumber: e.bankDetails.accountNumber,
      }
    : null;

  const created = await PayrollPayout.create({
    ref: payrollPayoutRef(),
    employeeId,
    code: e.code,
    name: e.name,
    designation: e.designation ?? "",
    scheduleId: ctx.schedule.id,
    scheduleName: ctx.schedule.name,
    periodKey: ctx.period.key,
    periodLabel: periodLabel(ctx.period.start, ctx.period.end),
    periodStart: dayStart(ctx.period.start),
    periodEnd: dayStart(ctx.period.end),
    upTo: dayStart(ctx.upTo),
    early: ctx.early,
    items: plan.items,
    totalMinor: plan.totalMinor,
    status: "processing",
    provider: "manual",
    method: ctx.method,
    reference,
    paidAt,
    paidBy: actor.sub,
    bank,
    activity: [
      {
        authorId: actor.sub,
        body: `Recording ${formatBDT(plan.totalMinor, "en")} for ${periodLabel(ctx.period.start, ctx.period.end)}`,
        at: new Date(),
      },
    ],
    createdBy: actor.sub,
  });
  const payout = { _id: created._id, ref: created.ref };

  const taken: IPayoutItem[] = [];
  let whole = true;
  for (const item of plan.items) {
    if (await claimItem(item, payout, employeeId, paidAt, actor)) {
      taken.push(item);
    } else {
      whole = false;
      break;
    }
  }

  if (!whole) {
    for (const item of taken.reverse()) {
      await releaseItem(
        item,
        payout,
        employeeId,
        actor,
        "the payout was cancelled",
      );
    }
    await PayrollPayout.updateOne(
      { _id: payout._id },
      {
        $set: { status: "cancelled" },
        $push: {
          activity: {
            authorId: actor.sub,
            body: "Cancelled: something it included was paid or changed while it was being recorded. Nothing was paid.",
            at: new Date(),
          },
        },
      },
    ).exec();
    return fail("changed");
  }

  const doc = await PayrollPayout.findOneAndUpdate(
    { _id: payout._id, status: "processing" },
    {
      $set: { status: "paid" },
      $push: {
        activity: {
          authorId: actor.sub,
          body: `Paid ${formatBDT(plan.totalMinor, "en")} by ${ctx.method}${reference ? ` (${reference})` : ""}`,
          at: new Date(),
        },
      },
    },
    { returnDocument: "after" },
  )
    .lean<Lean<IPayrollPayout>>()
    .exec();
  return doc ? done(doc) : fail("changed");
}

/** Where a period stands today, and up to which day it can be paid. */
export function periodState(
  period: Period,
  today: DayKey,
): { state: "upcoming" | "running" | "ended"; upTo: DayKey } {
  if (today < period.start) return { state: "upcoming", upTo: period.start };
  if (today < period.end) {
    // Paying before the period is over pays up to and including today; the
    // rest follows with the next payout for the same period.
    return { state: "running", upTo: addDays(today, 1) };
  }
  return { state: "ended", upTo: period.end };
}

export type PayRequest = {
  schedule: string;
  periodKey: string;
  employeeIds: string[];
  method: PayoutMethod;
  reference?: string | null;
  paidOn?: DayKey;
};

export type PayOutcome = {
  employeeId: string;
  name: string;
  ok: boolean;
  code?: PayoutError;
  payoutId?: string;
  ref?: string;
  totalMinor?: number;
};

/**
 * Pay the people asked for, each with their own payout. One person's failure
 * never stops the others; each outcome says what happened.
 */
export async function payPeople(
  req: PayRequest,
  actor: Actor,
  now = new Date(),
): Promise<PayoutResult<PayOutcome[]>> {
  await connectToDatabase();
  const resolved = await resolveSchedule(req.schedule);
  if (!resolved) return fail("bad_schedule");
  const period = periodByKey(resolved.versions, req.periodKey);
  if (!period) return fail("bad_period");
  const today = todayKey(now);
  const { state, upTo } = periodState(period, today);
  if (state === "upcoming") return fail("period_not_started");

  // A payout must point at a real schedule; the built-in default is saved
  // the first time anyone is paid on it.
  const schedule = resolved.virtual
    ? await ensureDefaultSchedule(actor)
    : resolved;
  const people = await Employee.find({
    ...peopleOnSchedule(schedule),
    _id: { $in: req.employeeIds },
  })
    .select(PAYEE_FIELDS)
    .lean<Payee[]>()
    .exec();
  const byId = new Map(people.map((p) => [String(p._id), p]));

  const outcomes: PayOutcome[] = [];
  for (const id of req.employeeIds) {
    const e = byId.get(id);
    if (!e) {
      outcomes.push({
        employeeId: id,
        name: "",
        ok: false,
        code: "not_on_schedule",
      });
      continue;
    }
    const res = await payOne(
      e,
      {
        schedule,
        period,
        upTo,
        early: state === "running",
        method: req.method,
        reference: req.reference,
        paidOn: req.paidOn ?? today,
      },
      actor,
    );
    outcomes.push(
      res.ok
        ? {
            employeeId: id,
            name: e.name,
            ok: true,
            payoutId: String(res.data._id),
            ref: res.data.ref,
            totalMinor: res.data.totalMinor,
          }
        : { employeeId: id, name: e.name, ok: false, code: res.code },
    );
  }
  return done(outcomes);
}

// ───────────────────────────── undoing ─────────────────────────────

/** A payout still `processing` this long after it began was interrupted. */
const STALE_PROCESSING_MS = 2 * 60_000;

/** Whether a payout can be voided: paid, or interrupted while recording. */
export function voidable(
  payout: Pick<IPayrollPayout, "status" | "createdAt">,
  now = new Date(),
): boolean {
  if (payout.status === "paid") return true;
  return (
    payout.status === "processing" &&
    now.getTime() - new Date(payout.createdAt).getTime() > STALE_PROCESSING_MS
  );
}

/**
 * Void a payout recorded by mistake: everything it paid becomes due again.
 * Also how one interrupted half-way (the server stopped mid-write) gives back
 * what it had taken.
 *
 * Only someone's latest payout — a later one started where this one's salary
 * ended, so voiding an earlier one would leave a hole in the days paid.
 */
export async function voidPayout(
  id: string,
  reason: string,
  actor: Actor,
): Promise<PayoutResult<Lean<IPayrollPayout>>> {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return fail("not_found");
  const payout = await PayrollPayout.findById(id)
    .lean<Lean<IPayrollPayout>>()
    .exec();
  if (!payout) return fail("not_found");
  if (!voidable(payout)) return fail("not_paid");

  const later = await PayrollPayout.exists({
    employeeId: payout.employeeId,
    status: "paid",
    createdAt: { $gt: payout.createdAt },
  }).exec();
  if (later) return fail("not_latest");

  const employeeId = oid(payout.employeeId);
  const salary = payout.items.find((i) => i.kind === "salary");
  // An interrupted payout may never have taken its salary; handing back is
  // conditional on what it holds, so only a paid one has to match.
  if (salary && payout.status === "paid") {
    const e = await Employee.findById(employeeId)
      .select({ salaryPaidThrough: 1 })
      .lean<{ salaryPaidThrough?: Date | null } | null>()
      .exec();
    const now = e?.salaryPaidThrough
      ? new Date(e.salaryPaidThrough).getTime()
      : null;
    if (now !== (salary.to ? new Date(salary.to).getTime() : null)) {
      return fail("salary_moved");
    }
  }

  const flipped = await PayrollPayout.findOneAndUpdate(
    { _id: payout._id, status: payout.status },
    {
      $set: {
        status: "voided",
        voidedAt: new Date(),
        voidedBy: actor.sub,
        voidReason: reason,
      },
      $push: {
        activity: {
          authorId: actor.sub,
          body: `Voided: ${reason}`,
          at: new Date(),
        },
      },
    },
    { returnDocument: "after" },
  )
    .lean<Lean<IPayrollPayout>>()
    .exec();
  if (!flipped) return fail("not_paid");

  const handle = { _id: oid(payout._id), ref: payout.ref };
  for (const item of [...payout.items].reverse()) {
    await releaseItem(item, handle, employeeId, actor, "the payout was voided");
  }
  return done(flipped);
}

/**
 * Record that someone's salary was paid up to a day outside the system — so
 * their first payout does not pay it again. Never earlier than a payout that
 * already paid salary: those days are on record as paid by it.
 */
export async function setSalaryPaidThrough(
  employeeId: string,
  through: DayKey,
  actor: Actor,
): Promise<PayoutResult<{ salaryPaidThrough: Date }>> {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(employeeId)) return fail("not_found");
  const pointer = dayStart(addDays(through, 1));
  const lastPaid = await PayrollPayout.findOne({
    employeeId,
    status: { $in: ["processing", "paid"] },
    "items.kind": "salary",
  })
    .sort({ createdAt: -1 })
    .lean<Lean<IPayrollPayout>>()
    .exec();
  const paidTo = lastPaid?.items.find((i) => i.kind === "salary")?.to;
  if (paidTo && pointer < new Date(paidTo)) return fail("before_payout");

  const res = await Employee.findOneAndUpdate(
    { _id: employeeId, deletedAt: null },
    {
      $set: { salaryPaidThrough: pointer },
      $push: {
        activity: {
          at: new Date(),
          actorId: actor.sub,
          action: "salary.paid_through",
          note: `Salary marked paid up to ${formatDay(through)}`,
        },
      },
    },
    { returnDocument: "after" },
  )
    .select({ salaryPaidThrough: 1 })
    .lean<{ salaryPaidThrough?: Date | null } | null>()
    .exec();
  return res ? done({ salaryPaidThrough: pointer }) : fail("not_found");
}

// ───────────────────────────── reading ─────────────────────────────

export type BoardRow = {
  employeeId: string;
  name: string;
  code: string;
  designation: string;
  payScheme: string;
  active: boolean;
  plan: DuePlan | null;
  /** Payouts already recorded for this period of this schedule. */
  paid: Lean<IPayrollPayout>[];
  bank: {
    bankName: string | null;
    accountName: string | null;
    accountNumber: string;
  } | null;
};

export type Board = {
  schedule: ScheduleView;
  period: Period;
  state: "upcoming" | "running" | "ended";
  upTo: DayKey;
  payday: DayKey;
  rows: BoardRow[];
};

/**
 * One pay period of one schedule: who is on it, what each is owed, and what
 * has been paid. Defaults to the newest period that has ended.
 */
export async function scheduleBoard(
  ref: string,
  periodKey: string | null,
  now = new Date(),
): Promise<PayoutResult<Board>> {
  await connectToDatabase();
  const schedule = await resolveSchedule(ref);
  if (!schedule) return fail("bad_schedule");
  const today = todayKey(now);
  const period = periodKey
    ? periodByKey(schedule.versions, periodKey)
    : lastEndedPeriod(schedule.versions, today);
  if (!period) return fail("bad_period");
  const { state, upTo } = periodState(period, today);

  const [people, payouts] = await Promise.all([
    Employee.find(peopleOnSchedule(schedule))
      .sort({ name: 1 })
      .select(PAYEE_FIELDS)
      .lean<Payee[]>()
      .exec(),
    schedule.virtual
      ? Promise.resolve([] as Lean<IPayrollPayout>[])
      : PayrollPayout.find({
          scheduleId: schedule.id,
          periodKey: period.key,
          status: "paid",
        })
          .sort({ createdAt: 1 })
          .lean<Lean<IPayrollPayout>[]>()
          .exec(),
  ]);

  const rows: BoardRow[] = [];
  for (const e of people) {
    const id = String(e._id);
    const plan = state === "upcoming" ? null : await dueFor(e, upTo);
    const paid = payouts.filter((p) => String(p.employeeId) === id);
    // Someone inactive with nothing owed and nothing paid has no business here.
    if (
      e.status !== "active" &&
      !paid.length &&
      !(plan && plan.totalMinor > 0)
    ) {
      continue;
    }
    rows.push({
      employeeId: id,
      name: e.name,
      code: e.code,
      designation: e.designation,
      payScheme: e.payScheme,
      active: e.status === "active",
      plan,
      paid,
      bank: e.bankDetails?.accountNumber
        ? {
            bankName: e.bankDetails.bankName ?? null,
            accountName: e.bankDetails.accountName ?? null,
            accountNumber: e.bankDetails.accountNumber,
          }
        : null,
    });
  }
  // Paid for this period, then moved to another schedule: still shown here.
  const shown = new Set(rows.map((r) => r.employeeId));
  for (const p of payouts) {
    const id = String(p.employeeId);
    if (shown.has(id)) continue;
    shown.add(id);
    rows.push({
      employeeId: id,
      name: p.name,
      code: p.code,
      designation: p.designation,
      payScheme: "",
      active: false,
      plan: null,
      paid: payouts.filter((x) => String(x.employeeId) === id),
      bank: null,
    });
  }

  return done({
    schedule,
    period,
    state,
    upTo,
    payday: paydayOf(schedule, period),
    rows,
  });
}

/** Recent payouts, newest first. */
export async function listPayouts(
  filter: { employeeId?: string; limit?: number } = {},
): Promise<Lean<IPayrollPayout>[]> {
  await connectToDatabase();
  const q: Record<string, unknown> = {
    status: { $in: ["paid", "voided", "processing"] },
  };
  if (filter.employeeId) q.employeeId = filter.employeeId;
  return PayrollPayout.find(q)
    .sort({ createdAt: -1 })
    .limit(filter.limit ?? 50)
    .lean<Lean<IPayrollPayout>[]>()
    .exec();
}

export async function getPayout(
  id: string,
): Promise<Lean<IPayrollPayout> | null> {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id)) return null;
  return PayrollPayout.findById(id).lean<Lean<IPayrollPayout>>().exec();
}

/** Whether `payout` is its person's latest, so it may be voided. */
export async function isLatestPayout(
  payout: Lean<IPayrollPayout>,
): Promise<boolean> {
  await connectToDatabase();
  const later = await PayrollPayout.exists({
    employeeId: payout.employeeId,
    status: "paid",
    createdAt: { $gt: payout.createdAt },
  }).exec();
  return !later;
}

/**
 * Someone's next payout: their schedule's current period, what it holds so
 * far, and when it falls due. For the employee's own desk and the dashboard.
 */
export async function nextPayoutFor(
  e: Payee,
  now = new Date(),
): Promise<{
  schedule: ScheduleView;
  period: Period;
  payday: DayKey;
  accruedMinor: number;
  notes: string[];
}> {
  const schedule = await scheduleForEmployee(e);
  const today = todayKey(now);
  const period = periodAt(schedule.versions, today);
  const plan = await dueFor(e, addDays(today, 1));
  return {
    schedule,
    period,
    payday: paydayOf(schedule, period),
    accruedMinor: plan.totalMinor,
    notes: plan.notes,
  };
}

/**
 * How a claim set to be paid with payroll is (or was) paid, in words: "payout
 * SPM-PAY-…", "the November 2026 payroll" for one settled by a month from
 * before payouts, or the person's next payout while it waits. Null for a
 * claim paid any other way.
 */
export async function claimSettlement(claim: {
  status: string;
  settlement?: string | null;
  payrollMonth?: string | null;
  payrollPayoutId?: unknown;
  employeeId: unknown;
}): Promise<{ text: string; payoutId: string | null } | null> {
  if (claim.settlement !== "payroll") return null;
  await connectToDatabase();
  if (claim.payrollPayoutId) {
    const p = await PayrollPayout.findById(claim.payrollPayoutId)
      .select({ ref: 1 })
      .lean<{ ref: string } | null>()
      .exec();
    return {
      text: p ? `payout ${p.ref}` : "a payout",
      payoutId: String(claim.payrollPayoutId),
    };
  }
  if (claim.status === "reimbursed" && claim.payrollMonth) {
    return {
      text: `the ${labelOfKey(claim.payrollMonth)} payroll`,
      payoutId: null,
    };
  }
  if (claim.status !== "approved") return null;
  const e = await Employee.findById(claim.employeeId)
    .select(PAYEE_FIELDS)
    .lean<Payee | null>()
    .exec();
  if (!e) return { text: "their next payout", payoutId: null };
  const schedule = await scheduleForEmployee(e);
  const period = periodAt(schedule.versions, todayKey());
  return {
    text: `their next payout (${schedule.name}, payday ${formatDay(paydayOf(schedule, period))})`,
    payoutId: null,
  };
}

/**
 * How many people are owed money for a pay period that has already ended —
 * the dashboard's "payouts due" count.
 */
export async function payoutsDueCount(now = new Date()): Promise<number> {
  await connectToDatabase();
  const today = todayKey(now);
  const people = await Employee.find({ deletedAt: null })
    .select(PAYEE_FIELDS)
    .lean<Payee[]>()
    .exec();
  const schedules = new Map<string, ScheduleView>();
  let due = 0;
  for (const e of people) {
    const key = e.payScheduleId ? String(e.payScheduleId) : "";
    let schedule = schedules.get(key);
    if (!schedule) {
      schedule = await scheduleForEmployee(e);
      schedules.set(key, schedule);
    }
    const ended = lastEndedPeriod(schedule.versions, today);
    const plan = await dueFor(e, ended.end);
    if (plan.totalMinor > 0) due += 1;
  }
  return due;
}
