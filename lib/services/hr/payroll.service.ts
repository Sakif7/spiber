import { connectToDatabase } from "@/lib/db/connect";
import {
  PayrollRun,
  type IPayrollRun,
  type IPayrollLine,
} from "@/lib/models/payrollRun";
import { Employee } from "@/lib/models/employee";
import type { Lean } from "@/lib/models/_shared";
import { revenueBetween } from "@/lib/repositories/revenue.repo";
import {
  monthWindow,
  isPayrollMonth,
  type PayrollMonth,
} from "@/lib/hr/months";
import { shareOfRevenue } from "@/lib/hr/payroll-math";
import { rateForMonth } from "./employee.service";
import {
  reimbursementsForMonth,
  settleReimbursementsFor,
  unsettleReimbursementsFor,
  type ReimbursementGroup,
} from "./expense.service";

/**
 * Monthly payroll.
 *
 * A month is computed from the same revenue figure the dashboard shows —
 * online orders and offline sales orders together, counted when they were paid.
 * While it is a draft it recomputes on every read, because money for the month
 * is still arriving. Approving it freezes everything, so a late payment or a
 * changed percentage cannot alter a month the directors were already paid for.
 */

export type Actor = { sub: string; email: string };

/**
 * A month as the UI sees it.
 *
 * Optional `_id`, because a month nobody has worked on is computed on the fly
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
  | "line_not_found";

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

/** Was this person on the payroll during `month`? */
function employedDuring(
  e: { joinedAt: Date; leftAt?: Date | null },
  window: { start: Date; end: Date },
): boolean {
  if (new Date(e.joinedAt) >= window.end) return false;
  if (e.leftAt && new Date(e.leftAt) < window.start) return false;
  return true;
}

/**
 * Work out what the month owes, from live data.
 *
 * Pure in the sense that matters: it reads and calculates, and does not decide
 * whether to store the result.
 */
export async function computeMonth(month: PayrollMonth): Promise<
  PayrollResult<{
    revenue: Awaited<ReturnType<typeof revenueBetween>>;
    window: { start: Date; end: Date };
    lines: IPayrollLine[];
    totalMinor: number;
    reimbursements: ReimbursementGroup[];
    reimbursementTotalMinor: number;
  }>
> {
  if (!isPayrollMonth(month)) return fail("bad_month");
  await connectToDatabase();

  const window = monthWindow(month);
  // Reimbursements are read here but deliberately NOT folded into revenue:
  // each director's share is a percentage of what the company took, and
  // handing a lunch receipt back is not a reduction in takings.
  const [revenue, employees, reimbursements] = await Promise.all([
    revenueBetween(window.start, window.end),
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
    reimbursementsForMonth(month),
  ]);

  const lines: IPayrollLine[] = [];
  for (const e of employees) {
    if (!employedDuring(e, window)) continue;

    if (e.payScheme === "revenue_share") {
      const rateBp = await rateForMonth(String(e._id), month);
      if (rateBp == null) continue; // no share agreed yet — nothing to pay
      lines.push({
        employeeId: String(e._id),
        code: e.code,
        name: e.name,
        designation: e.designation,
        payScheme: e.payScheme,
        rateBp,
        amountMinor: shareOfRevenue(revenue.totalMinor, rateBp),
      });
    } else if (e.payScheme === "fixed" && e.fixedMonthlyMinor) {
      lines.push({
        employeeId: String(e._id),
        code: e.code,
        name: e.name,
        designation: e.designation,
        payScheme: e.payScheme,
        rateBp: null,
        amountMinor: e.fixedMonthlyMinor,
      });
    }
    // payScheme "none" is deliberately not paid by this run.
  }

  return done({
    revenue,
    window,
    lines,
    totalMinor: lines.reduce((sum, l) => sum + l.amountMinor, 0),
    reimbursements,
    reimbursementTotalMinor: reimbursements.reduce(
      (sum, r) => sum + r.amountMinor,
      0,
    ),
  });
}

/**
 * The month's run: recomputed while it is a draft, returned as stored once it
 * has been approved.
 *
 * Reading a month NEVER creates one. A month nobody has worked on comes back as
 * a transient draft, so browsing through the year does not litter the
 * collection with empty runs; approving is what first commits a month.
 */
export async function getRun(
  month: PayrollMonth,
  actor: Actor,
): Promise<PayrollResult<PayrollRunView>> {
  if (!isPayrollMonth(month)) return fail("bad_month");
  await connectToDatabase();

  const existing = await PayrollRun.findOne({ month })
    .lean<Lean<IPayrollRun>>()
    .exec();
  if (existing?.status === "approved")
    return done(withReimbursements(existing));

  const computed = await computeMonth(month);
  if (!computed.ok) return computed;

  // Keep whatever has already been marked paid on a draft line.
  const paidByEmployee = new Map(
    (existing?.lines ?? []).map((l) => [String(l.employeeId), l]),
  );
  const lines = computed.data.lines.map((l) => {
    const prior = paidByEmployee.get(String(l.employeeId));
    return prior?.paidAt
      ? {
          ...l,
          paidAt: prior.paidAt,
          reference: prior.reference,
          paidBy: prior.paidBy,
        }
      : l;
  });

  const draft = draftFrom(month, computed.data, lines, actor);

  // Only refresh a run that is already on record.
  if (!existing) return done(draft);

  const doc = await PayrollRun.findOneAndUpdate(
    { month, status: { $ne: "approved" } },
    { $set: draft },
    { returnDocument: "after" },
  )
    .lean<Lean<IPayrollRun>>()
    .exec();

  return doc ? done(withReimbursements(doc)) : done(draft);
}

/** The shape a computed month takes, stored or not. */
function draftFrom(
  month: PayrollMonth,
  computed: {
    revenue: Awaited<ReturnType<typeof revenueBetween>>;
    window: { start: Date; end: Date };
    totalMinor: number;
    reimbursements: ReimbursementGroup[];
    reimbursementTotalMinor: number;
  },
  lines: IPayrollLine[],
  actor: Actor,
): PayrollRunView {
  return {
    month,
    status: "draft" as const,
    lines,
    totalMinor: computed.totalMinor,
    reimbursements: computed.reimbursements,
    reimbursementTotalMinor: computed.reimbursementTotalMinor,
    grandTotalMinor: computed.totalMinor + computed.reimbursementTotalMinor,
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

/** Freeze the month. Nothing recomputes it afterwards. */
export async function approveRun(
  month: PayrollMonth,
  actor: Actor,
): Promise<PayrollResult<Lean<IPayrollRun>>> {
  if (!isPayrollMonth(month)) return fail("bad_month");
  await connectToDatabase();

  // Freeze the CURRENT figures, so approving is never a snapshot of stale
  // numbers, and commit the month if this is the first time it is stored.
  const fresh = await getRun(month, actor);
  if (!fresh.ok) return fresh;
  if (fresh.data.status === "approved") return fail("already_approved");

  const doc = await PayrollRun.findOneAndUpdate(
    { month, status: { $ne: "approved" } },
    {
      $set: {
        lines: fresh.data.lines,
        totalMinor: fresh.data.totalMinor,
        reimbursements: fresh.data.reimbursements,
        reimbursementTotalMinor: fresh.data.reimbursementTotalMinor,
        grandTotalMinor: fresh.data.grandTotalMinor,
        revenue: fresh.data.revenue,
        status: "approved",
        approvedAt: new Date(),
        approvedBy: actor.sub,
        generatedAt: new Date(),
        generatedBy: actor.sub,
      },
      $setOnInsert: { month },
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
  if (!doc) return fail("not_found");

  // Freezing the month is what commits the reimbursements, so the claims are
  // marked paid here and can no longer be settled a second time by a direct
  // payout.
  await settleReimbursementsFor(month, actor);
  return done(doc);
}

/**
 * Reopen an approved month.
 *
 * Refused once any line has been paid: the money has left, so the record of
 * what was paid must not become editable. Correct it in a later month instead.
 */
export async function reopenRun(
  month: PayrollMonth,
  reason: string,
  actor: Actor,
): Promise<PayrollResult<Lean<IPayrollRun>>> {
  if (!isPayrollMonth(month)) return fail("bad_month");
  await connectToDatabase();

  const run = await PayrollRun.findOne({ month })
    .lean<Lean<IPayrollRun>>()
    .exec();
  if (!run) return fail("not_found");
  if (run.status !== "approved") return fail("not_approved");
  if (run.lines.some((l) => l.paidAt)) return fail("has_paid_lines");

  const doc = await PayrollRun.findOneAndUpdate(
    { month, status: "approved" },
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
  if (!doc) return fail("not_found");

  // The commitment is undone with the month. Reopening is already refused once
  // a line has been paid, so no money has followed these.
  await unsettleReimbursementsFor(month, actor);
  return done(doc);
}

/** Record that one director has actually been paid. */
export async function markLinePaid(
  month: PayrollMonth,
  employeeId: string,
  input: { paidAt?: string; reference?: string },
  actor: Actor,
): Promise<PayrollResult<Lean<IPayrollRun>>> {
  if (!isPayrollMonth(month)) return fail("bad_month");
  await connectToDatabase();

  const run = await PayrollRun.findOne({ month })
    .lean<Lean<IPayrollRun>>()
    .exec();
  // Only an approved month can be paid out: a draft is still moving, and a
  // month nobody has approved has no stored run at all.
  if (!run || run.status !== "approved") return fail("not_approved");
  if (!run.lines.some((l) => String(l.employeeId) === employeeId)) {
    return fail("line_not_found");
  }

  const doc = await PayrollRun.findOneAndUpdate(
    { month, "lines.employeeId": employeeId },
    {
      $set: {
        "lines.$.paidAt": input.paidAt ? new Date(input.paidAt) : new Date(),
        "lines.$.reference": input.reference || null,
        "lines.$.paidBy": actor.sub,
      },
    },
    { returnDocument: "after" },
  )
    .lean<Lean<IPayrollRun>>()
    .exec();
  return doc ? done(doc) : fail("not_found");
}

/** Past runs, newest first, for the month navigator. */
export async function listRuns(limit = 24): Promise<Lean<IPayrollRun>[]> {
  await connectToDatabase();
  return PayrollRun.find({})
    .sort({ month: -1 })
    .limit(limit)
    .lean<Lean<IPayrollRun>[]>()
    .exec();
}
