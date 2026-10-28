import mongoose, { Schema, type Model } from "mongoose";
import type {
  PaymentLinkBasis,
  PaymentRequestStatus,
  PaymentSubjectKind,
} from "@/lib/schemas/payment";

/** One time the link went out by email. */
export interface IPaymentRequestSend {
  email: string;
  at: Date;
  by: mongoose.Types.ObjectId | null;
}

/**
 * A pay link: `/pay/<token>`, for one thing at one amount. It stays the same
 * while the payer tries and fails; every click opens a fresh attempt at the
 * gateway (PayStation refuses a reused invoice number), and the attempt that
 * settles closes the link.
 */
export interface IPaymentRequest {
  /** 32 random bytes, base64url — the only thing that opens the link. */
  token: string;
  subject: {
    kind: PaymentSubjectKind;
    id: mongoose.Types.ObjectId;
    /** What the payer knows it by: the invoice number. */
    ref: string;
  };
  /**
   * A Sales invoice's: the whole total, or less the withholding on record.
   * Read it through `linkBasisOf()` — links from before the choice have none.
   */
  basis?: PaymentLinkBasis;
  /** What was owed: the invoice total, less what the client withholds. */
  dueMinor: number;
  /** Withheld at source (AIT, VDS) and so not asked for; 0 on a full link. */
  withheldMinor: number;
  /** What the link asks for: whole taka, in poisha. */
  amountMinor: number;
  /** Poisha dropped from `dueMinor` to make it whole taka (0 to −99). */
  roundingMinor: number;
  /** One line on the payment page and at the gateway. */
  description: string;
  customer: {
    name: string;
    organisation?: string | null;
    email: string;
    phone?: string | null;
  };
  status: PaymentRequestStatus;
  paidAt?: Date | null;
  /** The attempt that paid it. */
  attemptId?: mongoose.Types.ObjectId | null;
  cancelledAt?: Date | null;
  cancelReason?: string | null;
  sentTo: IPaymentRequestSend[];
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const paymentRequestSchema = new Schema<IPaymentRequest>(
  {
    token: { type: String, required: true },
    subject: {
      kind: { type: String, required: true },
      id: { type: Schema.Types.ObjectId, required: true },
      ref: { type: String, required: true },
    },
    basis: { type: String, enum: ["full", "less_withholding"] },
    dueMinor: { type: Number, required: true, min: 0 },
    withheldMinor: { type: Number, default: 0, min: 0 },
    amountMinor: { type: Number, required: true, min: 0 },
    roundingMinor: { type: Number, default: 0 },
    description: { type: String, required: true },
    customer: {
      name: { type: String, required: true },
      organisation: { type: String, default: null },
      email: { type: String, required: true },
      phone: { type: String, default: null },
    },
    status: {
      type: String,
      enum: ["open", "paid", "cancelled"],
      default: "open",
    },
    paidAt: { type: Date, default: null },
    attemptId: { type: Schema.Types.ObjectId, default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: null },
    sentTo: {
      type: [
        new Schema<IPaymentRequestSend>(
          {
            email: { type: String, required: true },
            at: { type: Date, required: true },
            by: { type: Schema.Types.ObjectId, ref: "User", default: null },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { collection: "payment_requests", timestamps: true },
);

paymentRequestSchema.index({ token: 1 }, { unique: true });
paymentRequestSchema.index({
  "subject.kind": 1,
  "subject.id": 1,
  createdAt: -1,
});
// At most one open link per thing: two super admins pressing "Make link" at
// once cannot leave two live links that would each take the money.
paymentRequestSchema.index(
  { "subject.kind": 1, "subject.id": 1 },
  { unique: true, partialFilterExpression: { status: "open" } },
);

export const PaymentRequest: Model<IPaymentRequest> =
  (mongoose.models.PaymentRequest as Model<IPaymentRequest>) ??
  mongoose.model<IPaymentRequest>("PaymentRequest", paymentRequestSchema);
