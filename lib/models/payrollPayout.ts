import mongoose, { Schema, type Model, type Types } from "mongoose";

/**
 * One payout: money handed to one person, once, for everything they had
 * earned and not yet been paid when their pay period ended.
 *
 * What a payout may include, as items:
 *
 *   share             their line of an approved profit period
 *   salary            their fixed salary for a run of days, [from, to)
 *   claims            approved expense claims set to be paid with payroll
 *   run_salary        a salary line of a month approved before payouts
 *   run_reimbursement claims a month approved before payouts had frozen
 *
 * Every item is claimed with a conditional update on the record it came from
 * (the run line, the employee's salary pointer, the claim), so the same money
 * can never be paid by two payouts — the database is standalone, with no
 * transactions, so a payout that loses a race hands back what it had claimed
 * and records itself as cancelled. `status` is `processing` only while that
 * happens, or while a gateway is still moving the money once one is wired.
 */
export type PayoutItemKind =
  | "share"
  | "salary"
  | "claims"
  | "run_salary"
  | "run_reimbursement";

export interface IPayoutItem {
  kind: PayoutItemKind;
  amountMinor: number;
  /** What it was for, ready to print: "November 2026", "1–15 Nov 2026"… */
  label: string;
  /** share / run_salary / run_reimbursement: the profit period's key. */
  runKey?: string | null;
  /** share: the holding it was paid on. */
  shares?: number | null;
  poolShares?: number | null;
  /** share, legacy: the percentage a month was paid on before shares. */
  rateBp?: number | null;
  /** salary: the days paid, as instants of Dhaka midnight. */
  from?: Date | null;
  to?: Date | null;
  monthlyMinor?: number | null;
  /** salary: where the employee's pointer stood before, to hand it back. */
  previousThrough?: Date | null;
  /** claims / run_reimbursement */
  expenseIds?: (Types.ObjectId | string)[];
  refs?: string[];
}

export type PayoutStatus = "processing" | "paid" | "cancelled" | "voided";

export interface IPayrollPayout {
  /** SPM-PAY-… */
  ref: string;
  employeeId: Types.ObjectId | string;
  code: string;
  name: string;
  designation: string;
  scheduleId: Types.ObjectId | string;
  scheduleName: string;
  /** The pay period it closes. */
  periodKey: string;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  /**
   * Everything earned before this instant was paid: the period's end, or the
   * start of tomorrow for a payout made before the period was over.
   */
  upTo: Date;
  early: boolean;
  items: IPayoutItem[];
  totalMinor: number;
  status: PayoutStatus;
  /** How the money moved: recorded by hand today, a gateway later. */
  provider: "manual";
  method: string;
  reference?: string | null;
  /** The day the money went. */
  paidAt?: Date | null;
  paidBy?: Types.ObjectId | string | null;
  /** Where it was sent, as the record stood at the time. */
  bank?: {
    bankName?: string | null;
    accountName?: string | null;
    accountNumber?: string | null;
  } | null;
  voidedAt?: Date | null;
  voidedBy?: Types.ObjectId | string | null;
  voidReason?: string | null;
  activity: {
    authorId?: Types.ObjectId | string | null;
    body: string;
    at: Date;
  }[];
  createdBy: Types.ObjectId | string;
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<IPayoutItem>(
  {
    kind: {
      type: String,
      enum: ["share", "salary", "claims", "run_salary", "run_reimbursement"],
      required: true,
    },
    amountMinor: { type: Number, required: true, min: 0 },
    label: { type: String, required: true },
    runKey: { type: String, default: null },
    shares: { type: Number, default: null },
    poolShares: { type: Number, default: null },
    rateBp: { type: Number, default: null },
    from: { type: Date, default: null },
    to: { type: Date, default: null },
    monthlyMinor: { type: Number, default: null },
    previousThrough: { type: Date, default: null },
    expenseIds: [{ type: Schema.Types.ObjectId, ref: "Expense" }],
    refs: { type: [String], default: undefined },
  },
  { _id: false },
);

const payoutSchema = new Schema<IPayrollPayout>(
  {
    ref: { type: String, required: true, unique: true },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    code: { type: String, required: true },
    name: { type: String, required: true },
    designation: { type: String, default: "" },
    scheduleId: {
      type: Schema.Types.ObjectId,
      ref: "PaySchedule",
      required: true,
    },
    scheduleName: { type: String, required: true },
    periodKey: { type: String, required: true },
    periodLabel: { type: String, required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    upTo: { type: Date, required: true },
    early: { type: Boolean, default: false },
    items: { type: [itemSchema], default: [] },
    totalMinor: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["processing", "paid", "cancelled", "voided"],
      default: "processing",
    },
    provider: { type: String, enum: ["manual"], default: "manual" },
    method: { type: String, required: true },
    reference: { type: String, default: null },
    paidAt: { type: Date, default: null },
    paidBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    bank: {
      type: new Schema(
        {
          bankName: { type: String, default: null },
          accountName: { type: String, default: null },
          accountNumber: { type: String, default: null },
        },
        { _id: false },
      ),
      default: null,
    },
    voidedAt: { type: Date, default: null },
    voidedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    voidReason: { type: String, default: null },
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
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { collection: "payroll_payouts", timestamps: true },
);

payoutSchema.index({ employeeId: 1, status: 1, createdAt: -1 });
payoutSchema.index({ scheduleId: 1, periodKey: 1, status: 1 });
payoutSchema.index({ status: 1, createdAt: -1 });

export const PayrollPayout: Model<IPayrollPayout> =
  (mongoose.models.PayrollPayout as Model<IPayrollPayout>) ??
  mongoose.model<IPayrollPayout>("PayrollPayout", payoutSchema);
