import mongoose, { Schema, type Model } from "mongoose";

/**
 * The sandbox gateway's own ledger — what PayStation keeps on its side. Only
 * the `dev` provider reads or writes it, and that provider refuses to run in
 * production.
 */
export interface IDevPayment {
  invoiceNumber: string;
  /** What we asked for. */
  amountMinor: number;
  /** pending until "paid"; a decline or cancel leaves it pending, as PayStation does. */
  state: "pending" | "paid";
  /** What the "customer" paid — a test can make it differ. */
  paidMinor?: number | null;
  trxId?: string | null;
  callbackUrl: string;
  reference?: string;
  createdAt: Date;
  updatedAt: Date;
}

const devPaymentSchema = new Schema<IDevPayment>(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    amountMinor: { type: Number, required: true },
    state: { type: String, default: "pending" },
    paidMinor: { type: Number, default: null },
    trxId: { type: String, default: null },
    callbackUrl: { type: String, required: true },
    reference: String,
  },
  { collection: "dev_payments", timestamps: true },
);

export const DevPayment: Model<IDevPayment> =
  (mongoose.models.DevPayment as Model<IDevPayment>) ??
  mongoose.model<IDevPayment>("DevPayment", devPaymentSchema);
