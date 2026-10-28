import mongoose, { Schema, type Model } from "mongoose";
import type {
  PaymentAttemptStatus,
  PaymentCheckVia,
  PaymentIssue,
  PaymentSubjectKind,
} from "@/lib/schemas/payment";

/** One look at the gateway: what we asked, what it said. */
export interface IPaymentCheck {
  at: Date;
  via: PaymentCheckVia;
  /** Normalized: pending | paid | failed | refunded | unknown | error. */
  state: string;
  raw?: unknown;
}

/**
 * One try at the gateway. A customer who cancels and pays again makes a
 * second attempt with a fresh invoice number (PayStation refuses a reused
 * one), so an order, a course or a quote may have several; at most one is
 * ever applied.
 */
export interface IPaymentAttempt {
  /** Ours, unique per try, and the gateway's `invoice_number`. */
  invoiceNumber: string;
  provider: string;
  /** live | sandbox | dev — a sandbox payment must never pass for a real one. */
  mode: string;
  subject: {
    kind: PaymentSubjectKind;
    id: mongoose.Types.ObjectId;
    /** The human reference the subject is known by (order number, …). */
    ref: string;
  };
  /** What we asked for: whole taka, in poisha. */
  amountMinor: number;
  /**
   * Poisha dropped from the subject's total to make `amountMinor` whole taka,
   * when the subject itself was not rounded (an order placed before rounding).
   */
  roundingMinor?: number;
  status: PaymentAttemptStatus;
  /** Why money that arrived was not applied. */
  issue?: PaymentIssue | null;
  paymentUrl?: string | null;
  /** Language to bring the customer back in. */
  locale?: string | null;
  trxId?: string | null;
  /** As the gateway names it: "bKash", "MASTERCARD", … */
  method?: string | null;
  payerMobile?: string | null;
  /** What the gateway says it took, in poisha. */
  paidMinor?: number | null;
  paidAt?: Date | null;
  /** The gateway's fee, frozen when the payment settled. */
  feeMinor?: number | null;
  feeRateBp?: number | null;
  /** Set when a super admin corrected the fee to the gateway's statement. */
  feeCorrected?: {
    by: mongoose.Types.ObjectId;
    at: Date;
    note?: string;
  } | null;
  refund?: {
    reference: string;
    note?: string;
    at: Date;
    by: mongoose.Types.ObjectId | null;
  } | null;
  checks: IPaymentCheck[];
  lastCheckedAt?: Date | null;
  /** When the sweeper should next ask the gateway about an open attempt. */
  nextCheckAt?: Date | null;
  /** Staff member who sent a payment link; null for a customer's own try. */
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const checkSchema = new Schema<IPaymentCheck>(
  {
    at: { type: Date, required: true },
    via: { type: String, required: true },
    state: { type: String, required: true },
    raw: Schema.Types.Mixed,
  },
  { _id: false },
);

const paymentAttemptSchema = new Schema<IPaymentAttempt>(
  {
    invoiceNumber: { type: String, required: true },
    provider: { type: String, required: true },
    mode: { type: String, required: true },
    subject: {
      kind: { type: String, required: true },
      id: { type: Schema.Types.ObjectId, required: true },
      ref: { type: String, required: true },
    },
    amountMinor: { type: Number, required: true, min: 0 },
    roundingMinor: { type: Number },
    status: {
      type: String,
      enum: ["open", "paid", "failed", "abandoned", "needs_refund", "refunded"],
      default: "open",
    },
    issue: { type: String, default: null },
    paymentUrl: { type: String, default: null },
    locale: { type: String, default: null },
    trxId: { type: String, default: null },
    method: { type: String, default: null },
    payerMobile: { type: String, default: null },
    paidMinor: { type: Number, default: null },
    paidAt: { type: Date, default: null },
    feeMinor: { type: Number, default: null },
    feeRateBp: { type: Number, default: null },
    feeCorrected: {
      type: new Schema(
        {
          by: { type: Schema.Types.ObjectId, ref: "User", required: true },
          at: { type: Date, required: true },
          note: String,
        },
        { _id: false },
      ),
      default: null,
    },
    refund: {
      type: new Schema(
        {
          reference: { type: String, required: true },
          note: String,
          at: { type: Date, required: true },
          by: { type: Schema.Types.ObjectId, ref: "User", default: null },
        },
        { _id: false },
      ),
      default: null,
    },
    checks: { type: [checkSchema], default: [] },
    lastCheckedAt: { type: Date, default: null },
    nextCheckAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { collection: "payment_attempts", timestamps: true },
);

// The gateway's invoice number is ours and must never repeat.
paymentAttemptSchema.index({ invoiceNumber: 1 }, { unique: true });
paymentAttemptSchema.index({
  "subject.kind": 1,
  "subject.id": 1,
  createdAt: -1,
});
// The sweeper: open attempts whose next look is due.
paymentAttemptSchema.index({ status: 1, nextCheckAt: 1 });
// The ledger: newest first, filtered by status.
paymentAttemptSchema.index({ status: 1, createdAt: -1 });
paymentAttemptSchema.index({ createdAt: -1 });
// The report: payments settled in a window.
paymentAttemptSchema.index({ paidAt: 1 });

export const PaymentAttempt: Model<IPaymentAttempt> =
  (mongoose.models.PaymentAttempt as Model<IPaymentAttempt>) ??
  mongoose.model<IPaymentAttempt>("PaymentAttempt", paymentAttemptSchema);
