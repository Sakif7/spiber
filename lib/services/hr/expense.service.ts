import type { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import {
  Expense,
  type IExpense,
  type IExpenseLine,
} from "@/lib/models/expense";
import type { Lean } from "@/lib/models/_shared";
import { expenseRef } from "@/lib/ids";
import { formatBDT } from "@/lib/money";
import { isPeriodKey, labelOfKey } from "@/lib/hr/cycles";
import { expenseLinesOf, type ExpenseLine } from "@/lib/hr/expense-lines";
import type {
  ExpenseCreateInput,
  ExpenseLineInput,
  ExpenseUpdateInput,
  ExpenseApproveInput,
  ExpenseRejectInput,
  ExpenseReimburseInput,
} from "@/lib/schemas/expense";

/**
 * Expense claims.
 *
 * A claim is a bill of lines, and it is decided and paid as a whole: there is
 * no per-line approval. A wrong line is taken off by editing the bill while
 * it is still submitted.
 *
 * The lifecycle is submitted → approved → reimbursed, with rejected as the
 * other ending. Approving is where the settlement route is chosen: `payroll`
 * leaves the claim for the person's next payout, on their pay schedule;
 * `direct` leaves it to be paid out on its own.
 *
 * `reimbursedAt` is the one guard that stops a claim being paid twice, and
 * every write that moves money checks it.
 */

export type Actor = { sub: string; email: string };

/** An id as the callers hold it. */
type Id = string | Types.ObjectId;

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
 * The bill as stored: its lines on Dhaka days, and the total and first day
 * worked out from them. The total is never taken from the client — it is
 * the sum of what the lines say, so the two cannot disagree.
 */
function billFrom(lines: ExpenseLineInput[]): {
  lines: IExpenseLine[];
  amountMinor: number;
  spentAt: Date;
} {
  const stored = lines.map<IExpenseLine>((l) => ({
    spentAt: dhakaDay(l.spentAt),
    category: l.category,
    description: l.description?.trim() || null,
    amountMinor: l.amountMinor,
  }));
  return {
    lines: stored,
    amountMinor: stored.reduce((sum, l) => sum + l.amountMinor, 0),
    spentAt: new Date(Math.min(...stored.map((l) => l.spentAt.getTime()))),
  };
}

/** Two bills' lines compared as the reader sees them. */
const linesKey = (lines: ExpenseLine[]) =>
  JSON.stringify(
    lines.map((l) => [
      new Date(l.spentAt).getTime(),
      l.category,
      l.description ?? "",
      l.amountMinor,
    ]),
  );

export async function createExpense(
  input: ExpenseCreateInput,
  actor: Actor,
): Promise<Lean<IExpense>> {
  await connectToDatabase();
  const bill = billFrom(input.lines);
  const doc = await Expense.create({
    ref: expenseRef(),
    visitId: input.visitId || null,
    employeeId: input.employeeId,
    description: input.description,
    ...bill,
    receiptDocumentIds: input.receiptDocumentIds ?? [],
    status: "submitted",
    createdBy: actor.sub,
    activity: [
      {
        authorId: actor.sub,
        body:
          bill.lines.length === 1
            ? "Claim recorded"
            : `Claim recorded — a bill of ${bill.lines.length} lines`,
        at: new Date(),
      },
    ],
  });
  return doc.toObject() as Lean<IExpense>;
}

/**
 * Only a claim nobody has ruled on yet can be edited — which is also how a
 * wrong line is taken off a bill before it is approved, so a change to the
 * lines is written into the claim's history with what it did to the total.
 */
export async function updateExpense(
  id: string,
  input: ExpenseUpdateInput,
  actor?: Actor,
): Promise<ExpenseResult<Lean<IExpense>>> {
  await connectToDatabase();
  const current = await Expense.findOne({ _id: id, deletedAt: null })
    .lean<Lean<IExpense>>()
    .exec();
  if (!current) return fail("not_found");
  if (current.status !== "submitted") return fail("not_editable");

  const set: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};
  let note: string | null = null;
  if (input.visitId !== undefined) set.visitId = input.visitId || null;
  if (input.employeeId !== undefined) set.employeeId = input.employeeId;
  if (input.description !== undefined) set.description = input.description;
  if (input.lines !== undefined) {
    const bill = billFrom(input.lines);
    Object.assign(set, bill);
    // A claim from before bills becomes a bill on its first edit; its old
    // single category now lives on its line.
    unset.category = "";
    if (linesKey(bill.lines) !== linesKey(expenseLinesOf(current))) {
      note =
        bill.amountMinor === current.amountMinor
          ? "Lines edited"
          : `Lines edited — total ${formatBDT(current.amountMinor, "en")} → ${formatBDT(bill.amountMinor, "en")}`;
    }
  }
  if (input.receiptDocumentIds !== undefined) {
    set.receiptDocumentIds = input.receiptDocumentIds;
    set.receiptDocumentId = null;
  }

  const update: Record<string, unknown> = { $set: set };
  if (Object.keys(unset).length) update.$unset = unset;
  if (note && actor) {
    update.$push = {
      activity: { authorId: actor.sub, body: note, at: new Date() },
    };
  }
  const doc = await Expense.findOneAndUpdate(
    { _id: id, status: "submitted", deletedAt: null },
    update,
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

  const route =
    input.settlement === "payroll" ? "their next payout" : "a direct payout";
  const wasApproved = current.status === "approved";
  const body = wasApproved
    ? `Settlement changed to ${route}`
    : `Approved — to be paid with ${route}`;

  const doc = await Expense.findOneAndUpdate(
    { _id: id, reimbursedAt: null, deletedAt: null },
    {
      $set: {
        status: "approved",
        settlement: input.settlement,
        // Legacy field: a payroll claim waits for a payout, not a month.
        payrollMonth: null,
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

/** A person's approved payroll claims that no payout has taken yet. */
export async function payrollClaimsDue(
  employeeId: Id,
): Promise<{ _id: unknown; ref: string; amountMinor: number }[]> {
  await connectToDatabase();
  return Expense.find({
    employeeId,
    settlement: "payroll",
    status: "approved",
    reimbursedAt: null,
    deletedAt: null,
  })
    .sort({ approvedAt: 1, createdAt: 1 })
    .select({ ref: 1, amountMinor: 1 })
    .lean<{ _id: unknown; ref: string; amountMinor: number }[]>()
    .exec();
}

/**
 * Take claims for a payout: each one only if it is still approved, still to
 * be paid with payroll and not yet paid. True when every one was taken; on
 * false, whatever this call did take has already been handed back.
 */
export async function claimForPayout(
  expenseIds: Id[],
  payout: { _id: Id; ref: string },
  employeeId: Id,
  paidAt: Date,
  actor: Actor,
): Promise<boolean> {
  await connectToDatabase();
  for (const id of expenseIds) {
    const res = await Expense.updateOne(
      {
        _id: id,
        employeeId,
        settlement: "payroll",
        status: "approved",
        reimbursedAt: null,
        deletedAt: null,
      },
      {
        $set: {
          status: "reimbursed",
          reimbursedAt: paidAt,
          reimbursedBy: actor.sub,
          payrollPayoutId: payout._id,
        },
        $push: {
          activity: {
            authorId: actor.sub,
            body: `Paid back with payout ${payout.ref}`,
            at: new Date(),
          },
        },
      },
    ).exec();
    if (res.modifiedCount !== 1) {
      await releaseFromPayout(payout, actor, "the payout did not go through");
      return false;
    }
  }
  return true;
}

/** Hand a payout's claims back: approved again, waiting for the next one. */
export async function releaseFromPayout(
  payout: { _id: Id; ref: string },
  actor: Actor,
  why: string,
): Promise<number> {
  await connectToDatabase();
  const res = await Expense.updateMany(
    { payrollPayoutId: payout._id, status: "reimbursed" },
    {
      $set: {
        status: "approved",
        reimbursedAt: null,
        reimbursedBy: null,
        payrollPayoutId: null,
      },
      $push: {
        activity: {
          authorId: actor.sub,
          body: `Back to approved — ${why} (${payout.ref})`,
          at: new Date(),
        },
      },
    },
  ).exec();
  return res.modifiedCount ?? 0;
}

/**
 * Put a month's claims back to approved when a run from before payouts is
 * reopened — such a run marked them reimbursed when it was approved.
 *
 * Reopening is already refused once a payroll line has been paid, so this only
 * ever unwinds a commitment no money has followed. They then wait for the
 * person's next payout, like any other approved claim.
 */
export async function unsettleReimbursementsFor(
  key: string,
  actor: Actor,
): Promise<number> {
  if (!isPeriodKey(key)) return 0;
  await connectToDatabase();
  const now = new Date();
  const res = await Expense.updateMany(
    {
      settlement: "payroll",
      payrollMonth: key,
      status: "reimbursed",
      // Only ones this run settled: a direct payout records how it was paid,
      // and a payout records itself.
      payout: null,
      payrollPayoutId: null,
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
          body: `Back to approved — the ${labelOfKey(key)} payroll was reopened`,
          at: now,
        },
      },
    },
  ).exec();
  return res.modifiedCount ?? 0;
}
