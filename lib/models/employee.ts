import mongoose, { Schema, type Model, type Types } from "mongoose";

/**
 * A person on the company's payroll.
 *
 * Today that means the directors, who are paid a share of monthly revenue. The
 * shape anticipates the rest: `kind` separates a director from ordinary staff,
 * and `payScheme` is the hook attendance- or salary-based pay will use, so
 * adding those later does not require reshaping what payroll already produced.
 * See docs/hr-extension-points.md.
 */
export interface IEmployeeBank {
  bankName?: string | null;
  branch?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  routingNumber?: string | null;
}

export interface IEmployee {
  code: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  /** Optional link to an admin account, so a person is not duplicated. */
  userId?: Types.ObjectId | string | null;
  designation: string;
  kind: "director" | "staff";
  /**
   * How this person is paid. `revenue_share` is the only scheme payroll
   * computes today; `fixed` and `none` are recorded but not yet calculated.
   */
  payScheme: "revenue_share" | "fixed" | "none";
  /** For the `fixed` scheme, once it is implemented. */
  fixedMonthlyMinor?: number | null;
  joinedAt: Date;
  leftAt?: Date | null;
  status: "active" | "inactive";
  bankDetails?: IEmployeeBank | null;
  notes?: string | null;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const bankSchema = new Schema<IEmployeeBank>(
  {
    bankName: { type: String, default: null },
    branch: { type: String, default: null },
    accountName: { type: String, default: null },
    accountNumber: { type: String, default: null },
    routingNumber: { type: String, default: null },
  },
  { _id: false },
);

const employeeSchema = new Schema<IEmployee>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true, default: null },
    phone: { type: String, default: null },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    designation: { type: String, required: true, trim: true },
    kind: { type: String, enum: ["director", "staff"], default: "director" },
    payScheme: {
      type: String,
      enum: ["revenue_share", "fixed", "none"],
      default: "revenue_share",
    },
    fixedMonthlyMinor: { type: Number, default: null, min: 0 },
    joinedAt: { type: Date, required: true },
    leftAt: { type: Date, default: null },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    bankDetails: { type: bankSchema, default: null },
    notes: { type: String, default: null },
    deletedAt: { type: Date, default: null },
  },
  { collection: "employees", timestamps: true },
);

employeeSchema.index({ deletedAt: 1, status: 1, name: 1 });
// One employee record per linked account.
employeeSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: "objectId" } } },
);

export const Employee: Model<IEmployee> =
  (mongoose.models.Employee as Model<IEmployee>) ??
  mongoose.model<IEmployee>("Employee", employeeSchema);

/**
 * A revenue-share percentage, effective from a given month.
 *
 * Append-only: changing someone's share adds a record rather than editing one,
 * so a payroll month already produced keeps the rate that was actually agreed
 * at the time. Without this, a percentage change would silently rewrite history.
 */
export interface IEmployeeShareRate {
  employeeId: Types.ObjectId | string;
  rateBp: number;
  /** "YYYY-MM" — the first month this rate applies to. */
  effectiveFrom: string;
  createdBy: Types.ObjectId | string;
  note?: string | null;
  createdAt: Date;
}

const shareRateSchema = new Schema<IEmployeeShareRate>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    rateBp: { type: Number, required: true, min: 0, max: 10000 },
    effectiveFrom: { type: String, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    note: { type: String, default: null },
  },
  {
    collection: "employee_share_rates",
    timestamps: { createdAt: true, updatedAt: false },
  },
);

// "The rate in force for this month" is the newest record at or before it.
shareRateSchema.index({ employeeId: 1, effectiveFrom: -1, createdAt: -1 });

export const EmployeeShareRate: Model<IEmployeeShareRate> =
  (mongoose.models.EmployeeShareRate as Model<IEmployeeShareRate>) ??
  mongoose.model<IEmployeeShareRate>("EmployeeShareRate", shareRateSchema);
