import mongoose, { Schema, type Model } from "mongoose";
import type { SellerCommissionStatus } from "@/lib/schemas/seller-commission";

/**
 * A seller's commission ledger entry — one per (order, seller). A financial
 * record: soft-delete/void only, never hard-delete. Rate is snapshotted so a
 * later per-seller rate change doesn't alter recorded amounts.
 */

/** Per-item fee breakdown (rates can differ per category within one order). */
export interface ICommissionLine {
  productId: mongoose.Types.ObjectId | string;
  name: string;
  qty: number;
  subtotalMinor: number;
  rateBp: number;
  /** Which rate applied: the seller's override, a category rate, or the global default. */
  rateSource: "seller" | "category" | "global";
  commissionMinor: number;
}

export interface ISellerCommission {
  orderId: mongoose.Types.ObjectId | string;
  orderNumber: string;
  sellerId: mongoose.Types.ObjectId | string;
  /** Sum of this seller's item line totals in the order (poisha). */
  itemSubtotalMinor: number;
  /** Effective (blended) rate — per-line rates live in `lines`. */
  commissionRateBp: number;
  commissionAmountMinor: number;
  sellerEarningsMinor: number;
  /** Per-item breakdown (absent on legacy rows accrued before category rates). */
  lines?: ICommissionLine[];
  currency: "BDT";
  status: SellerCommissionStatus;
  accruedAt: Date;
  paidAt?: Date | null;
  payoutId?: mongoose.Types.ObjectId | string | null;
  note?: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const sellerCommissionSchema = new Schema<ISellerCommission>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true },
    orderNumber: { type: String, required: true },
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
      index: true,
    },
    itemSubtotalMinor: { type: Number, required: true },
    commissionRateBp: { type: Number, required: true },
    commissionAmountMinor: { type: Number, required: true },
    sellerEarningsMinor: { type: Number, required: true },
    lines: {
      type: [
        new Schema<ICommissionLine>(
          {
            productId: { type: Schema.Types.ObjectId, ref: "Product" },
            name: { type: String, required: true },
            qty: { type: Number, required: true },
            subtotalMinor: { type: Number, required: true },
            rateBp: { type: Number, required: true },
            rateSource: {
              type: String,
              enum: ["seller", "category", "global"],
              required: true,
            },
            commissionMinor: { type: Number, required: true },
          },
          { _id: false },
        ),
      ],
      default: undefined,
    },
    currency: { type: String, default: "BDT" },
    status: {
      type: String,
      enum: ["accrued", "paid", "void"],
      default: "accrued",
      index: true,
    },
    accruedAt: { type: Date, required: true },
    paidAt: { type: Date, default: null },
    payoutId: {
      type: Schema.Types.ObjectId,
      ref: "SellerPayout",
      default: null,
    },
    note: { type: String },
    deletedAt: { type: Date, default: null },
  },
  { collection: "seller_commissions", timestamps: true },
);

// One commission per (order, seller) — idempotent accrual.
sellerCommissionSchema.index({ orderId: 1, sellerId: 1 }, { unique: true });
sellerCommissionSchema.index({ createdAt: -1 });

export const SellerCommission: Model<ISellerCommission> =
  (mongoose.models.SellerCommission as Model<ISellerCommission>) ??
  mongoose.model<ISellerCommission>("SellerCommission", sellerCommissionSchema);
