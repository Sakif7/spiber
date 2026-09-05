import mongoose, { Schema, type Model } from "mongoose";

/** What we did with a callback, kept so a disputed payment can be traced. */
export type PaymentEventResult =
  | "applied"
  | "failed_payment"
  | "amount_mismatch"
  | "order_not_found"
  | "late_payment"
  | "already_settled";

export interface IPaymentEvent {
  provider: string;
  /** The gateway's id for this delivery. Unique per provider, so replays lose. */
  eventId: string;
  orderId?: mongoose.Types.ObjectId | null;
  orderNumber: string;
  outcome: "paid" | "failed";
  /** What the gateway said it took, in poisha. */
  amountMinor: number;
  /** What the order actually costs, recorded so a mismatch stays visible. */
  expectedMinor?: number | null;
  txnId?: string;
  result: PaymentEventResult;
  raw?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const paymentEventSchema = new Schema<IPaymentEvent>(
  {
    provider: { type: String, required: true },
    eventId: { type: String, required: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    orderNumber: { type: String, required: true },
    outcome: { type: String, required: true },
    amountMinor: { type: Number, required: true },
    expectedMinor: { type: Number, default: null },
    txnId: { type: String },
    result: { type: String, required: true },
    raw: Schema.Types.Mixed,
  },
  { collection: "payment_events", timestamps: true },
);

// The replay guard. A second delivery of the same event hits this and is
// rejected before anything is applied, so a retrying gateway cannot double-pay
// an order. Never drop this index.
paymentEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
paymentEventSchema.index({ orderNumber: 1, createdAt: -1 });

export const PaymentEvent: Model<IPaymentEvent> =
  (mongoose.models.PaymentEvent as Model<IPaymentEvent>) ??
  mongoose.model<IPaymentEvent>("PaymentEvent", paymentEventSchema);
