import { connectToDatabase } from "@/lib/db/connect";
import { Expense, type IExpense } from "@/lib/models/expense";
import { Employee } from "@/lib/models/employee";
import { PayrollRun } from "@/lib/models/payrollRun";
import type { Lean } from "@/lib/models/_shared";
import { expenseRef } from "@/lib/ids";
import { monthOf, nextMonth, isPayrollMonth } from "@/lib/hr/months";
import type { PayrollMonth } from "@/lib/hr/months";
import type {
  ExpenseCreateInput,
  ExpenseUpdateInput,
  ExpenseApproveInput,
  ExpenseRejectInput,
  ExpenseReimburseInput,
} from "@/lib/schemas/expense";

/**
 * Expense claims.
 *
 * The lifecycle is submitted → approved → reimbursed, with rejected as the
 * other ending. Approving is where the settlement route is chosen: `payroll`
 * parks the claim on a month's run, `direct` leaves it to be paid out on its
 * own.
 *
 * `reimbursedAt` is the one guard that stops a claim being paid twice, and
 * every write that moves money checks it.
 */

export type Actor = { sub: string; email: string };

export type ExpenseError =
  | "not_found"
  | "not_editable"
  | "not_approvable"
  | "not_rejectable"
  | "not_reimbursable"
  | "wrong_settlement"
  | "already_reimbursed"
  | "month_closed"
  | "bad_month";

export type ExpenseResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: ExpenseError };

const fail = (code: ExpenseError): ExpenseResult<never> => ({
  ok: false,
  code,
});
const done = <T>(data: T): ExpenseResult<T> => ({ ok: true, data });

function dhakaDay(value: string): Date {
  return new Date(`${value}T00:00:00+06:00`);
}

/**
 * The earliest month a reimbursement can still join.
 *
 * Approving a payroll run freezes it, so a claim approved today cannot be
 * added to a month that has already been signed off — it rolls to the next
 * open one. The cap is a safety net: it would take two years of consecutive
 * approved-in-advance months to reach it.
 */
export async function openPayrollMonth(
  now = new Date(),
): Promise<PayrollMonth> {
  await connectToDatabase();
  let month = monthOf(now);
  for (let i = 0; i < 24; i++) {
    const run = await PayrollRun.findOne({ month })
      .select({ status: 1 })
      .lean<{ status: string } | null>()
      .exec();
    if (run?.status !== "approved") return month;
    month = nextMonth(month);
  }
  return month;
}

export async function createExpense(
  input: ExpenseCreateInput,
  actor: Actor,
): Promise<Lean<IExpense>> {
  await connectToDatabase();
  const doc = await Expense.create({
    ref: expenseRef(),
    visitId: input.visitId || null,
    employeeId: input.employeeId,
    category: input.category,
    amountMinor: input.amountMinor,
    spentAt: dhakaDay(input.spentAt),
    description: input.description,
    receiptDocumentId: input.receiptDocumentId || null,
    status: "submitted",
    createdBy: actor.sub,
    activity: [{ authorId: actor.sub, body: "Claim recorded", at: new Date() }],
  });
  return doc.toObject() as Lean<IExpense>;
}

/** Only a claim nobody has ruled on yet can be edited. */
export async function updateExpense(
  id: string,
  input: ExpenseUpdateInput,
): Promise<ExpenseResult<Lean<IExpense>>> {
  await connectToDatabase();
  const current = await Expense.findOne({ _id: id, deletedAt: null })
    .lean<Lean<IExpense>>()
    .exec();
  if (!current) return fail("not_found");
  if (current.status !== "submitted") return fail("not_editable");

  const set: Record<string, unknown> = {};
  if (input.visitId !== undefined) set.visitId = input.visitId || null;
  if (input.employeeId !== undefined) set.employeeId = input.employeeId;
  if (input.category !== undefined) set.category = input.category;
  if (input.amountMinor !== undefined) set.amountMinor = input.amountMinor;
  if (input.spentAt !== undefined) set.spentAt = dhakaDay(input.spentAt);
  if (input.description !== undefined) set.description = input.description;
  if (input.receiptDocumentId !== undefined)
    set.receiptDocumentId = input.receiptDocumentId || null;

  const doc = await Expense.findOneAndUpdate(
    { _id: id, status: "submitted", deletedAt: null },
    { $set: set },
    { returnDocument: "after" },
  )
    .lean<Lean<IExpense>>()
    .exec();
  return doc ? done(doc) : fail("not_editable");
}

/**
 * Approve a claim and choose how it gets paid back.
 *
 * Also accepts an already-approved claim, which is how the route is changed
 * afterwards — but never one that has been reimbursed, because the money has
 * already moved.
 */
export async function approveExpense(
  id: string,
  input: ExpenseApproveInput,
  actor: Actor,
): Promise<ExpenseResult<Lean<IExpense>>> {
  await connectToDatabase();
  const current = await Expense.findOne({ _id: id, deletedAt: null })
    .lean<Lean<IExpense>>()
    .exec();
  if (!current) return fail("not_found");
  if (current.reimbursedAt) return fail("already_reimbursed");
  if (current.status !== "submitted" && current.status !== "approved") {
    return fail("not_approvable");
  }

  const payrollMonth =
    input.settlement === "payroll" ? await openPayrollMonth() : null;

  const wasApproved = current.status === "approved";
  const body = wasApproved
    ? `Settlement changed to ${input.settlement === "payroll" ? `the ${payrollMonth} payroll` : "a direct payout"}`
    : `Approved for ${input.settlement === "payroll" ? `the ${payrollMonth} payroll` : "a direct payout"}`;

  const doc = await Expense.findOneAndUpdate(
    { _id: id, reimbursedAt: null, deletedAt: null },
    {
      $set: {
        status: "approved",
        settlement: input.settlement,
        payrollMonth,
        approvedAt: current.approvedAt ?? new Date(),
        approvedBy: actor.sub,
        rejectedAt: null,
        rejectedBy: null,
        rejectionReason: null,
      },
      $push: {
        activity: {
          authorId: actor.sub,
          body: input.note ? `${body} — ${input.note}` : body,
          at: new Date(),
        },
      },
    },
    { returnDocument: "after" },
  )
    .lean<Lean<IExpense>>()
    .exec();
  return doc ? done(doc) : fail("already_reimbursed");
}

export async function rejectExpense(
  id: string,
  input: ExpenseRejectInput,
  actor: Actor,
): Promise<ExpenseResult<Lean<IExpense>>> {
  await connectToDatabase();
  const doc = await Expense.findOneAndUpdate(
    {
      _id: id,
      status: { $in: ["submitted", "approved"] },
      reimbursedAt: null,
      deletedAt: null,
    },
    {
      $set: {
        status: "rejected",
        settlement: null,
        payrollMonth: null,
        rejectedAt: new Date(),
        rejectedBy: actor.sub,
        rejectionReason: input.reason,
      },
      $push: {
        activity: {
          authorId: actor.sub,
          body: `Rejected: ${input.reason}`,
          at: new Date(),
        },
      },
    },
    { returnDocument: "after" },
  )
    .lean<Lean<IExpense>>()
    .exec();
  return doc ? done(doc) : fail("not_rejectable");
}

/** Record a payout made outside payroll. */
export async function reimburseDirect(
  id: string,
  input: ExpenseReimburseInput,
  actor: Actor,
): Promise<ExpenseResult<Lean<IExpense>>> {
  await connectToDatabase();
  const current = await Expense.findOne({ _id: id, deletedAt: null })
    .lean<Lean<IExpense>>()
    .exec();
  if (!current) return fail("not_found");
  if (current.reimbursedAt) return fail("already_reimbursed");
  if (current.status !== "approved") return fail("not_reimbursable");
  // A claim parked on a payroll run is settled by approving that run, so
  // paying it here as well is exactly the double-payment to prevent.
  if (current.settlement !== "direct") return fail("wrong_settlement");

  const doc = await Expense.findOneAndUpdate(
    {
      _id: id,
      status: "approved",
      settlement: "direct",
      reimbursedAt: null,
      deletedAt: null,
    },
    {
      $set: {
        status: "reimbursed",
        reimbursedAt: input.paidAt ? dhakaDay(input.paidAt) : new Date(),
        reimbursedBy: actor.sub,
        payout: { method: input.method, reference: input.reference || null },
      },
      $push: {
        activity: {
          authorId: actor.sub,
          body: `Reimbursed by ${input.method}${input.reference ? ` (${input.reference})` : ""}`,
          at: new Date(),
        },
      },
    },
    { returnDocument: "after" },
  )
    .lean<Lean<IExpense>>()
    .exec();
  return doc ? done(doc) : fail("already_reimbursed");
}

/** Soft-delete. Never for money that has already moved. */
export async function deleteExpense(id: string): Promise<ExpenseResult<true>> {
  await connectToDatabase();
  const doc = await Expense.findOneAndUpdate(
    { _id: id, reimbursedAt: null, deletedAt: null },
    { $set: { deletedAt: new Date() } },
  ).exec();
  return doc ? done(true) : fail("not_found");
}

/** One director's reimbursement total for a month, with the claims behind it. */
export type ReimbursementGroup = {
  employeeId: string;
  code: string;
  name: string;
  amountMinor: number;
  expenseIds: string[];
};

/**
 * What a payroll month owes in reimbursements.
 *
 * Deliberately separate from the revenue share: this figure is ADDED to the
 * run after each director's percentage has been worked out, and never enters
 * the revenue the percentage is taken from.
 */
export async function reimbursementsForMonth(
  month: PayrollMonth,
): Promise<ReimbursementGroup[]> {
  if (!isPayrollMonth(month)) return [];
  await connectToDatabase();

  const claims = await Expense.find({
    settlement: "payroll",
    payrollMonth: month,
    status: "approved",
    reimbursedAt: null,
    deletedAt: null,
  })
    .lean<Lean<IExpense>[]>()
    .exec();
  if (claims.length === 0) return [];

  const employees = await Employee.find({
    _id: { $in: [...new Set(claims.map((c) => String(c.employeeId)))] },
  })
    .select({ code: 1, name: 1 })
    .lean<{ _id: unknown; code: string; name: string }[]>()
    .exec();
  const byId = new Map(employees.map((e) => [String(e._id), e]));

  const groups = new Map<string, ReimbursementGroup>();
  for (const c of claims) {
    const key = String(c.employeeId);
    const employee = byId.get(key);
    if (!employee) continue; // a deleted employee is not paid by this run
    const group = groups.get(key) ?? {
      employeeId: key,
      code: employee.code,
      name: employee.name,
      amountMinor: 0,
      expenseIds: [],
    };
    group.amountMinor += c.amountMinor;
    group.expenseIds.push(String(c._id));
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Mark a month's payroll-settled claims as paid.
 *
 * Called when the run is approved, because that is the moment the figures
 * freeze and the reimbursement becomes a commitment.
 */
export async function settleReimbursementsFor(
  month: PayrollMonth,
  actor: Actor,
): Promise<number> {
  if (!isPayrollMonth(month)) return 0;
  await connectToDatabase();
  const now = new Date();
  const res = await Expense.updateMany(
    {
      settlement: "payroll",
      payrollMonth: month,
      status: "approved",
      reimbursedAt: null,
      deletedAt: null,
    },
    {
      $set: {
        status: "reimbursed",
        reimbursedAt: now,
        reimbursedBy: actor.sub,
      },
      $push: {
        activity: {
          authorId: actor.sub,
          body: `Reimbursed with the ${month} payroll`,
          at: now,
        },
      },
    },
  ).exec();
  return res.modifiedCount ?? 0;
}

/**
 * Put a month's claims back to approved when its run is reopened.
 *
 * Reopening is already refused once a payroll line has been paid, so this only
 * ever unwinds a commitment no money has followed.
 */
export async function unsettleReimbursementsFor(
  month: PayrollMonth,
  actor: Actor,
): Promise<number> {
  if (!isPayrollMonth(month)) return 0;
  await connectToDatabase();
  const now = new Date();
  const res = await Expense.updateMany(
    {
      settlement: "payroll",
      payrollMonth: month,
      status: "reimbursed",
      // Only ones this run settled: a direct payout records how it was paid.
      payout: null,
      deletedAt: null,
    },
    {
      $set: {
        status: "approved",
        reimbursedAt: null,
        reimbursedBy: null,
      },
      $push: {
        activity: {
          authorId: actor.sub,
          body: `Back to approved — the ${month} payroll was reopened`,
          at: now,
        },
      },
    },
  ).exec();
  return res.modifiedCount ?? 0;
}
