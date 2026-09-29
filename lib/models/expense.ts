import mongoose, { Schema, type Model, type Types } from "mongoose";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
  type ExpenseCategory,
  type ExpenseStatus,
  type ExpenseSettlement,
} from "@/lib/hr/expense-constants";

/**
 * A cost incurred on company business that a director is owed back — a meal on
 * a visit, fuel for someone's car, a fare.
 *
 * A claim is a bill: `lines`, each with its own day, category, note and
 * amount, and `amountMinor` their total — the one figure every money path
 * reads. A claim from before bills has no `lines` and keeps its single
 * `category`; read lines through `expenseLinesOf()` (lib/hr/expense-lines),
 * never the fields directly.
 *
 * Two settlement routes, chosen when the claim is approved:
 *
 *   payroll — it rides along on a monthly payroll run as a reimbursement line,
 *             added AFTER the revenue share is computed. `payrollMonth` names
 *             the run it is waiting for, and approving that run is what marks
 *             it reimbursed.
 *   direct  — it is paid out on its own, whenever, and an admin records that.
 *
 * `reimbursedAt` is the single guard against paying twice: both routes refuse
 * to touch a claim that already has it, and a claim cannot change route once it
 * is set.
 *
 * ⚠ An expense must never reduce revenue. Directors are paid a percentage of
 * monthly revenue, so netting a reimbursement off the takings would quietly cut
 * everyone's pay to refund one lunch.
 */
export {
  EXPENSE_CATEGORIES,
  EXPENSE_STATUSES,
} from "@/lib/hr/expense-constants";
export type {
  ExpenseCategory,
  ExpenseStatus,
  ExpenseSettlement,
} from "@/lib/hr/expense-constants";

export interface IExpenseLine {
  spentAt: Date;
  category: ExpenseCategory;
  description?: string | null;
  amountMinor: number;
}

export interface IExpense {
  /** SPM-EXP-… */
  ref: string;
  /** The visit it was incurred on, when it was incurred on one. */
  visitId?: Types.ObjectId | string | null;
  /** Who paid, and therefore who is owed. */
  employeeId: Types.ObjectId | string;
  /** The bill. Absent on a claim recorded before bills had lines. */
  lines?: IExpenseLine[];
  /** Only on a claim from before bills; a bill's categories are its lines'. */
  category?: ExpenseCategory | null;
  /** The total of the lines. */
  amountMinor: number;
  /** The bill's first day — what the lists sort and filter by. */
  spentAt: Date;
  /** What the bill was for. */
  description: string;
  /** The receipts, filed encrypted in the company vault. */
  receiptDocumentIds?: (Types.ObjectId | string)[];
  /** Only on a claim from before bills: its one receipt. */
  receiptDocumentId?: Types.ObjectId | string | null;

  status: ExpenseStatus;
  settlement?: ExpenseSettlement | null;
  /** "YYYY-MM" — the payroll run this is waiting for, when settling by payroll. */
  payrollMonth?: string | null;

  approvedAt?: Date | null;
  approvedBy?: Types.ObjectId | string | null;
  rejectedAt?: Date | null;
  rejectedBy?: Types.ObjectId | string | null;
  rejectionReason?: string | null;

  reimbursedAt?: Date | null;
  reimbursedBy?: Types.ObjectId | string | null;
  /** How a direct payout was made; null when it rode a payroll run. */
  payout?: {
    method: string;
    reference?: string | null;
  } | null;

  activity: {
    authorId?: Types.ObjectId | string | null;
    body: string;
    at: Date;
  }[];
  createdBy: Types.ObjectId | string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const expenseSchema = new Schema<IExpense>(
  {
    ref: { type: String, required: true, unique: true },
    visitId: { type: Schema.Types.ObjectId, ref: "Visit", default: null },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    lines: {
      type: [
        new Schema<IExpenseLine>(
          {
            spentAt: { type: Date, required: true },
            category: {
              type: String,
              enum: EXPENSE_CATEGORIES,
              required: true,
            },
            description: {
              type: String,
              trim: true,
              maxlength: 300,
              default: null,
            },
            amountMinor: { type: Number, required: true, min: 1 },
          },
          { _id: false },
        ),
      ],
      default: undefined,
    },
    // Not required any more: a bill keeps its categories on its lines, and
    // only a claim from before bills has one here.
    category: { type: String, enum: EXPENSE_CATEGORIES },
    amountMinor: { type: Number, required: true, min: 1 },
    spentAt: { type: Date, required: true },
    description: { type: String, required: true, trim: true, maxlength: 300 },
    receiptDocumentIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "CompanyDocument" }],
      default: undefined,
    },
    receiptDocumentId: {
      type: Schema.Types.ObjectId,
      ref: "CompanyDocument",
      default: null,
    },

    status: { type: String, enum: EXPENSE_STATUSES, default: "submitted" },
    settlement: { type: String, enum: ["payroll", "direct"], default: null },
    payrollMonth: { type: String, default: null },

    approvedAt: { type: Date, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    rejectedAt: { type: Date, default: null },
    rejectedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    rejectionReason: { type: String, default: null, maxlength: 500 },

    reimbursedAt: { type: Date, default: null },
    reimbursedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    payout: {
      type: new Schema(
        {
          method: { type: String, required: true },
          reference: { type: String, default: null },
        },
        { _id: false },
      ),
      default: null,
    },

    activity: [
      new Schema(
        {
          authorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
          body: { type: String, required: true },
          at: { type: Date, default: Date.now },
        },
        { _id: false },
      ),
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "expenses" },
);

expenseSchema.index({ deletedAt: 1, status: 1, spentAt: -1 });
expenseSchema.index({ employeeId: 1, spentAt: -1 });
expenseSchema.index({ visitId: 1 });
// The payroll pickup query: approved, settling by payroll, for this month,
// not yet paid.
expenseSchema.index({ settlement: 1, payrollMonth: 1, status: 1 });

export const Expense: Model<IExpense> =
  (mongoose.models.Expense as Model<IExpense>) ||
  mongoose.model<IExpense>("Expense", expenseSchema);
