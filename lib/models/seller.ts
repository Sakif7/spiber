import mongoose, { Schema, type Model } from "mongoose";
import type { SellerStatus } from "@/lib/schemas/seller";

export interface IBankDetails {
  accountName?: string;
  bankName?: string;
  accountNumber?: string;
  branch?: string;
  routingNumber?: string;
  mobileWallet?: string;
}

export interface ISeller {
  userId: mongoose.Types.ObjectId | string;
  displayName: string;
  slug: string;
  logo?: string;
  bio?: string;
  bankDetails?: IBankDetails;
  /** Per-seller commission override in basis points; null → global default. */
  commissionBp?: number | null;
  status: SellerStatus;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const bankDetailsSchema = new Schema<IBankDetails>(
  {
    accountName: String,
    bankName: String,
    accountNumber: String,
    branch: String,
    routingNumber: String,
    mobileWallet: String,
  },
  { _id: false },
);

const sellerSchema = new Schema<ISeller>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    displayName: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
    logo: { type: String },
    bio: { type: String },
    bankDetails: { type: bankDetailsSchema, default: undefined },
    commissionBp: { type: Number, default: null },
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
      index: true,
    },
    deletedAt: { type: Date, default: null },
  },
  { collection: "sellers", timestamps: true },
);

// One live seller profile per user; unique slug among live sellers.
sellerSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
sellerSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

export const Seller: Model<ISeller> =
  (mongoose.models.Seller as Model<ISeller>) ??
  mongoose.model<ISeller>("Seller", sellerSchema);
