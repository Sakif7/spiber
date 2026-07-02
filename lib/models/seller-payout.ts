import mongoose, { Schema, type Model } from "mongoose";
import type { SellerPayoutStatus } from "@/lib/schemas/seller-commission";

/** A batched payout to a seller, covering a set of accrued commissions. */
export interface ISellerPayout {
  payoutNumber: string;
  sellerId: mongoose.Types.ObjectId | string;
  commissionIds: (mongoose.Types.ObjectId | string)[];
  totalEarningsMinor: number;
  currency: "BDT";
  status: SellerPayoutStatus;
  processedAt?: Date | null;
  note?: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const sellerPayoutSchema = new Schema<ISellerPayout>(
  {
    payoutNumber: { type: String, required: true, unique: true },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
      index: true,
    },
    commissionIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "SellerCommission" }],
      default: [],
    },
    totalEarningsMinor: { type: Number, required: true },
    currency: { type: String, default: "BDT" },
    status: {
      type: String,
      enum: ["pending", "processing", "paid", "failed"],
      default: "pending",
      index: true,
    },
    processedAt: { type: Date, default: null },
    note: { type: String },
    deletedAt: { type: Date, default: null },
  },
  { collection: "seller_payouts", timestamps: true },
);

sellerPayoutSchema.index({ createdAt: -1 });

export const SellerPayout: Model<ISellerPayout> =
  (mongoose.models.SellerPayout as Model<ISellerPayout>) ??
  mongoose.model<ISellerPayout>("SellerPayout", sellerPayoutSchema);
