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

/**
 * Something that happened to a person's access: a login created, an invite
 * sent, a mailbox provisioned, a password revealed. The audit log has the
 * same facts; this is the copy the employee page shows without a join.
 */
export interface IEmployeeEvent {
  at: Date;
  actorId?: Types.ObjectId | string | null;
  action: string;
  note?: string | null;
}

export interface IEmployeeEmailSignature {
  html: string;
  logo: boolean;
  updatedAt: Date;
}

export interface IEmployee {
  code: string;
  name: string;
  /** Their own, personal address — where the portal invite is sent. */
  email?: string | null;
  /**
   * The one company address: `name@spibermed.com`. It is the portal login
   * and the mailbox, provisioned when the record is created. Absent on a
   * record from before unified mail existed.
   */
  businessEmail?: string | null;
  phone?: string | null;
  /** The portal account (role `employee`), created with the record. */
  userId?: Types.ObjectId | string | null;
  /** When the set-password invite was last sent to the personal address. */
  invitedAt?: Date | null;
  /** When they first set a password (the invite was used). */
  inviteAcceptedAt?: Date | null;
  activity?: IEmployeeEvent[];
  designation: string;
  kind: "director" | "staff";
  /**
   * How this person is paid: a share of each profit period (`revenue_share`),
   * a fixed monthly salary earned by the day (`fixed`), or not through payroll
   * at all (`none`).
   */
  payScheme: "revenue_share" | "fixed" | "none";
  /** The `fixed` scheme's monthly salary, in poisha. */
  fixedMonthlyMinor?: number | null;
  /**
   * When they are paid: their pay schedule. Null is the company's default
   * schedule (lib/models/paySchedule.ts).
   */
  payScheduleId?: Types.ObjectId | string | null;
  /**
   * Salary is paid up to (not including) this instant — Dhaka midnight of the
   * first unpaid day. Moved forward by each payout that pays salary, and by
   * hand for someone paid outside the system before they were put on it.
   * Absent until then: salary is owed from when they joined, or from the end
   * of the last month approved before payouts that already paid it.
   */
  salaryPaidThrough?: Date | null;
  joinedAt: Date;
  leftAt?: Date | null;
  status: "active" | "inactive";
  bankDetails?: IEmployeeBank | null;
  notes?: string | null;
  /**
   * Their signature (a `PdfAsset` of kind "signature", encrypted at rest):
   * uploaded or drawn when the record is created, later from this page, or
   * by the person in their portal. Filled into a document's signature slot
   * when they acknowledge it. One per person; replacing it is audited.
   */
  signatureAssetId?: Types.ObjectId | string | null;
  signatureUpdatedAt?: Date | null;
  /**
   * What sits under a message they send from a company mailbox: rich text
   * from the composer's allowlist (sanitised on save) and whether the
   * company logo goes above it. Set on this page by a super admin; absent
   * means none. See lib/mail/signature.ts.
   */
  emailSignature?: IEmployeeEmailSignature | null;
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

const eventSchema = new Schema<IEmployeeEvent>(
  {
    at: { type: Date, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    action: { type: String, required: true },
    note: { type: String, default: null },
  },
  { _id: false },
);

const employeeSchema = new Schema<IEmployee>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true, default: null },
    businessEmail: {
      type: String,
      lowercase: true,
      trim: true,
      default: null,
    },
    phone: { type: String, default: null },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    invitedAt: { type: Date, default: null },
    inviteAcceptedAt: { type: Date, default: null },
    activity: { type: [eventSchema], default: [] },
    signatureAssetId: {
      type: Schema.Types.ObjectId,
      ref: "PdfAsset",
      default: null,
    },
    signatureUpdatedAt: { type: Date, default: null },
    emailSignature: {
      type: new Schema<IEmployeeEmailSignature>(
        {
          html: { type: String, required: true },
          logo: { type: Boolean, default: true },
          updatedAt: { type: Date, required: true },
        },
        { _id: false },
      ),
      default: null,
    },
    designation: { type: String, required: true, trim: true },
    kind: { type: String, enum: ["director", "staff"], default: "director" },
    payScheme: {
      type: String,
      enum: ["revenue_share", "fixed", "none"],
      default: "revenue_share",
    },
    fixedMonthlyMinor: { type: Number, default: null, min: 0 },
    payScheduleId: {
      type: Schema.Types.ObjectId,
      ref: "PaySchedule",
      default: null,
    },
    salaryPaidThrough: { type: Date, default: null },
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
// One company address per living record; a soft-deleted person frees theirs.
employeeSchema.index(
  { businessEmail: 1 },
  {
    unique: true,
    partialFilterExpression: {
      businessEmail: { $type: "string" },
      deletedAt: null,
    },
  },
);

export const Employee: Model<IEmployee> =
  (mongoose.models.Employee as Model<IEmployee>) ??
  mongoose.model<IEmployee>("Employee", employeeSchema);

/**
 * A director's shareholding, effective from a given month.
 *
 * The company issued a fixed pool of shares (`lib/hr/share-pool.ts`) and each
 * director bought a number of them; a month's distributable profit is split in
 * proportion to those holdings. `shares` is the live field. `rateBp` is the
 * percentage the first version of payroll used and is kept only so a month
 * approved under it still reads back — nothing writes it any more.
 *
 * Append-only: changing someone's holding adds a record rather than editing
 * one, so a payroll month already produced keeps the holding that was actually
 * in force at the time. Without this, a change would silently rewrite history.
 */
export interface IEmployeeShareRate {
  employeeId: Types.ObjectId | string;
  /** Shares held from `effectiveFrom`. Null only on a legacy percentage row. */
  shares?: number | null;
  /** Legacy: the percentage of revenue, in basis points. Never written now. */
  rateBp?: number | null;
  /** "YYYY-MM" — the first month this holding applies to. */
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
    shares: { type: Number, default: null, min: 0 },
    rateBp: { type: Number, default: null, min: 0, max: 10000 },
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
