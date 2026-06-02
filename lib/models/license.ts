import mongoose, { Schema, type Model } from "mongoose";
import type { LicenseStatus } from "@/lib/schemas/systems";

export interface ILicense {
  softwareProductId: mongoose.Types.ObjectId | string;
  userId?: mongoose.Types.ObjectId | string | null;
  /** The purchase that issued this license (renamed from the doc's `orderId`). */
  purchaseId?: mongoose.Types.ObjectId | string | null;
  key: string;
  status: LicenseStatus;
  issuedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const licenseSchema = new Schema<ILicense>(
  {
    softwareProductId: {
      type: Schema.Types.ObjectId,
      ref: "SoftwareProduct",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    purchaseId: {
      type: Schema.Types.ObjectId,
      ref: "SoftwarePurchase",
      default: null,
      index: true,
    },
    key: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["issued", "active", "revoked"],
      default: "issued",
      index: true,
    },
    issuedAt: { type: Date, required: true },
  },
  { collection: "licenses", timestamps: true },
);

export const License: Model<ILicense> =
  (mongoose.models.License as Model<ILicense>) ??
  mongoose.model<ILicense>("License", licenseSchema);
