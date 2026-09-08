import mongoose, { Schema, type Model, type Types } from "mongoose";

/**
 * One month's payroll.
 *
 * A run starts as a draft that recomputes whenever it is opened, because money
 * for the month is still arriving. Approving it FREEZES the figures: the
 * revenue snapshot, each rate and each amount are stored, so a payment recorded
 * later, or a percentage changed later, cannot rewrite a month the directors
 * have already been paid for.
 */
export interface IPayrollLine {
  employeeId: Types.ObjectId | string;
  code: string;
  name: string;
  designation: string;
  payScheme: string;
  /** The rate in force for this month; null for a scheme without one. */
  rateBp: number | null;
  amountMinor: number;
  paidAt?: Date | null;
  reference?: string | null;
  paidBy?: Types.ObjectId | string | null;
}

/**
 * A reimbursement owed to one director this month.
 *
 * Held separately from `lines` on purpose: a revenue share is a percentage of
 * the month's takings, a reimbursement is money being handed back. Mixing them
 * would let an expense influence a percentage.
 */
export interface IPayrollReimbursement {
  employeeId: Types.ObjectId | string;
  code: string;
  name: string;
  amountMinor: number;
  /** The claims this line settles. */
  expenseIds: (Types.ObjectId | string)[];
}

export interface IPayrollRun {
  /** "YYYY-MM" */
  month: string;
  status: "draft" | "approved";
  /** What the month's revenue was when the run was last computed. */
  revenue: {
    totalMinor: number;
    onlineMinor: number;
    manualMinor: number;
    onlineCount: number;
    manualCount: number;
    windowStart: Date;
    windowEnd: Date;
    capturedAt: Date;
  };
  lines: IPayrollLine[];
  /** Revenue share only — reimbursements are counted separately. */
  totalMinor: number;
  reimbursements: IPayrollReimbursement[];
  reimbursementTotalMinor: number;
  /** What actually leaves the bank: the share plus what is being handed back. */
  grandTotalMinor: number;
  generatedAt: Date;
  generatedBy: Types.ObjectId | string;
  approvedAt?: Date | null;
  approvedBy?: Types.ObjectId | string | null;
  reopenedAt?: Date | null;
  reopenedBy?: Types.ObjectId | string | null;
  activity: {
    authorId?: Types.ObjectId | string | null;
    body: string;
    at: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const lineSchema = new Schema<IPayrollLine>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    code: { type: String, required: true },
    name: { type: String, required: true },
    designation: { type: String, required: true },
    payScheme: { type: String, required: true },
    rateBp: { type: Number, default: null },
    amountMinor: { type: Number, required: true, min: 0 },
    paidAt: { type: Date, default: null },
    reference: { type: String, default: null },
    paidBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: false },
);

const reimbursementSchema = new Schema<IPayrollReimbursement>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    code: { type: String, required: true },
    name: { type: String, required: true },
    amountMinor: { type: Number, required: true, min: 0 },
    expenseIds: [{ type: Schema.Types.ObjectId, ref: "Expense" }],
  },
  { _id: false },
);

const payrollRunSchema = new Schema<IPayrollRun>(
  {
    month: { type: String, required: true, unique: true },
    status: { type: String, enum: ["draft", "approved"], default: "draft" },
    revenue: {
      totalMinor: { type: Number, default: 0 },
      onlineMinor: { type: Number, default: 0 },
      manualMinor: { type: Number, default: 0 },
      onlineCount: { type: Number, default: 0 },
      manualCount: { type: Number, default: 0 },
      windowStart: { type: Date, required: true },
      windowEnd: { type: Date, required: true },
      capturedAt: { type: Date, default: Date.now },
    },
    lines: { type: [lineSchema], default: [] },
    totalMinor: { type: Number, default: 0 },
    reimbursements: { type: [reimbursementSchema], default: [] },
    reimbursementTotalMinor: { type: Number, default: 0 },
    grandTotalMinor: { type: Number, default: 0 },
    generatedAt: { type: Date, default: Date.now },
    generatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reopenedAt: { type: Date, default: null },
    reopenedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    activity: {
      type: [
        new Schema(
          {
            authorId: {
              type: Schema.Types.ObjectId,
              ref: "User",
              default: null,
            },
            body: { type: String, required: true },
            at: { type: Date, default: Date.now },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { collection: "payroll_runs", timestamps: true },
);

payrollRunSchema.index({ month: -1 });

export const PayrollRun: Model<IPayrollRun> =
  (mongoose.models.PayrollRun as Model<IPayrollRun>) ??
  mongoose.model<IPayrollRun>("PayrollRun", payrollRunSchema);
