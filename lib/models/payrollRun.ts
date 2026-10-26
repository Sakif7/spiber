import mongoose, { Schema, type Model, type Types } from "mongoose";

/**
 * One profit period's payroll: the period's profit worked out and split
 * between the shareholders.
 *
 * A period is a calendar month unless the profit cycle says otherwise (see
 * `lib/hr/cycles.ts`), and `month` holds its key — "2026-11" for a month, as
 * every run before cycles had, "2026-11-01~2026-11-15" for anything else.
 *
 * A run starts as a draft that recomputes whenever it is opened, because money
 * for the period is still arriving. Approving it FREEZES the figures: the
 * pool, each holding and each amount are stored, so a payment recorded later,
 * or a holding changed later, cannot rewrite a period the directors have
 * already been paid for.
 *
 * Money leaves through payouts (`payrollPayout.ts`), on each person's pay
 * schedule: a share line is paid when a payout takes it, and records which.
 * Runs from before payouts (`format` absent) also carry each month's fixed
 * salaries and approved claims as payable lines; a run of format 2 carries
 * shares only, because salaries and claims are paid by the day and by the
 * claim, whenever the person's schedule says.
 */
export interface IPayrollLine {
  employeeId: Types.ObjectId | string;
  code: string;
  name: string;
  designation: string;
  payScheme: string;
  /**
   * Shares held this month, over the pool's `totalShares` at the time. Null
   * for a fixed salary, and on a line computed under the old percentage
   * scheme — those carry `rateBp` instead.
   */
  shares?: number | null;
  poolShares?: number | null;
  /** Legacy: the percentage in force, for a month approved before shares. */
  rateBp: number | null;
  amountMinor: number;
  paidAt?: Date | null;
  reference?: string | null;
  paidBy?: Types.ObjectId | string | null;
  /** The payout that paid it. Absent on a line marked paid before payouts. */
  payoutId?: Types.ObjectId | string | null;
}

/**
 * A reimbursement owed to one director this month — only on runs from before
 * payouts, which froze the month's approved claims here. Claims are now paid
 * by payouts directly and never ride a run.
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
  /** Set when a payout hands the money over. */
  paidAt?: Date | null;
  payoutId?: Types.ObjectId | string | null;
}

/** One person's fixed salary for the period, as the pool deducted it. */
export interface IPayrollSalaryLine {
  employeeId: Types.ObjectId | string;
  code: string;
  name: string;
  amountMinor: number;
}

/**
 * How the month's pool was arrived at, frozen with the run.
 *
 * The sales report's cash after AIT, less the fixed salaries paid this
 * month, is what the directors divide. Stored step by step so a payslip can
 * show its working and an approved month can be checked long after the
 * report has moved on.
 */
export interface IPayrollPool {
  /** The report's "Cash after AIT" for the month. */
  netCashMinor: number;
  /** Everything above cash: the terms the report took off to get there. */
  grossProfitMinor: number;
  orderCostsMinor: number;
  expensesMinor: number;
  aitMinor: number;
  /** Fixed salaries earned in the period, taken off before the split. */
  salariesMinor: number;
  /**
   * Who those salaries were, by the day (format 2). The salaries themselves
   * are paid by payouts, so they are a deduction here and not payable lines.
   */
  salaryLines?: IPayrollSalaryLine[];
  /** What was split. Never negative. */
  distributableMinor: number;
  /** The denominator of every director's fraction, at the time. */
  totalShares: number;
  /** Shares held by the directors on this run, added up. */
  allocatedShares: number;
}

export interface IPayrollRun {
  /** The period's key: "2026-11", or "2026-11-01~2026-11-15". */
  month: string;
  /**
   * 2 for a run worked out on a profit period, paid through payouts. Absent
   * on a run from before, which still holds payable salaries and claims.
   */
  format?: number | null;
  status: "draft" | "approved";
  /**
   * The month's pool. Optional because runs approved under the percentage
   * scheme have none — read it with a fallback.
   */
  pool?: IPayrollPool | null;
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
    shares: { type: Number, default: null },
    poolShares: { type: Number, default: null },
    rateBp: { type: Number, default: null },
    amountMinor: { type: Number, required: true, min: 0 },
    paidAt: { type: Date, default: null },
    reference: { type: String, default: null },
    paidBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    payoutId: {
      type: Schema.Types.ObjectId,
      ref: "PayrollPayout",
      default: null,
    },
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
    paidAt: { type: Date, default: null },
    payoutId: {
      type: Schema.Types.ObjectId,
      ref: "PayrollPayout",
      default: null,
    },
  },
  { _id: false },
);

const salaryLineSchema = new Schema<IPayrollSalaryLine>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    code: { type: String, required: true },
    name: { type: String, required: true },
    amountMinor: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const poolSchema = new Schema<IPayrollPool>(
  {
    netCashMinor: { type: Number, default: 0 },
    grossProfitMinor: { type: Number, default: 0 },
    orderCostsMinor: { type: Number, default: 0 },
    expensesMinor: { type: Number, default: 0 },
    aitMinor: { type: Number, default: 0 },
    salariesMinor: { type: Number, default: 0 },
    salaryLines: { type: [salaryLineSchema], default: undefined },
    distributableMinor: { type: Number, default: 0 },
    totalShares: { type: Number, default: 0 },
    allocatedShares: { type: Number, default: 0 },
  },
  { _id: false },
);

const payrollRunSchema = new Schema<IPayrollRun>(
  {
    month: { type: String, required: true, unique: true },
    format: { type: Number, default: null },
    status: { type: String, enum: ["draft", "approved"], default: "draft" },
    pool: { type: poolSchema, default: null },
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
// What a payout looks for: approved periods holding a person's unpaid line.
payrollRunSchema.index({ status: 1, "lines.employeeId": 1 });
// The latest stored period, which a change of profit cycle may not cut into.
payrollRunSchema.index({ "revenue.windowEnd": -1 });

export const PayrollRun: Model<IPayrollRun> =
  (mongoose.models.PayrollRun as Model<IPayrollRun>) ??
  mongoose.model<IPayrollRun>("PayrollRun", payrollRunSchema);
