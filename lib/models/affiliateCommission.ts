import mongoose, { Schema, type Model } from "mongoose";
import type { CommissionStatus } from "@/lib/schemas/systems";

/**
 * The Spiber owner's affiliate "cut" on an external-app sale (e.g. ZenHcare).
 * A financial ledger record — soft-delete only, never hard-delete. `rateBp` is
 * snapshotted so later product edits don't change recorded amounts.
 */
export interface IAffiliateCommission {
  purchaseId: mongoose.Types.ObjectId | string;
  softwareProductId: mongoose.Types.ObjectId | string;
  externalApp: string;
  userId: mongoose.Types.ObjectId | string;
  basePriceMinor: number;
  rateBp: number;
  amountMinor: number;
  currency: "BDT";
  status: CommissionStatus;
  accruedAt: Date;
  note?: string;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const affiliateCommissionSchema = new Schema<IAffiliateCommission>(
  {
    purchaseId: {
      type: Schema.Types.ObjectId,
      ref: "SoftwarePurchase",
      required: true,
    },
    softwareProductId: {
      type: Schema.Types.ObjectId,
      ref: "SoftwareProduct",
      required: true,
    },
    externalApp: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    basePriceMinor: { type: Number, required: true },
    rateBp: { type: Number, required: true },
    amountMinor: { type: Number, required: true },
    currency: { type: String, default: "BDT" },
    status: {
      type: String,
      enum: ["accrued", "paid", "void"],
      default: "accrued",
      index: true,
    },
    accruedAt: { type: Date, required: true },
    note: { type: String },
    deletedAt: { type: Date, default: null },
  },
  { collection: "affiliate_commissions", timestamps: true },
);

// One commission per purchase (idempotent fulfillment).
affiliateCommissionSchema.index({ purchaseId: 1 }, { unique: true });
affiliateCommissionSchema.index({ createdAt: -1 });

export const AffiliateCommission: Model<IAffiliateCommission> =
  (mongoose.models.AffiliateCommission as Model<IAffiliateCommission>) ??
  mongoose.model<IAffiliateCommission>(
    "AffiliateCommission",
    affiliateCommissionSchema,
  );
