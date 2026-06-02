import mongoose, { Schema, type Model } from "mongoose";
import { localizedDef, type LocalizedDoc } from "./_shared";
import type { IPaymentRef } from "@/lib/models/order";
import type { PurchaseStatus, DeliveryType } from "@/lib/schemas/systems";

export interface IPurchaseTimelineEntry {
  status: PurchaseStatus;
  at: Date;
  note?: string;
}

/** Immutable snapshot of the product at purchase time. */
export interface IPurchaseProductSnapshot {
  name: LocalizedDoc;
  slug: string;
  priceMinor: number;
  deliveryType: DeliveryType;
  externalApp?: string;
  affiliate?: { rateBp: number };
}

/** Links to whatever fulfillment produced (idempotent, set on entering "paid"). */
export interface IPurchaseFulfillment {
  type: DeliveryType;
  status: "pending" | "done" | "failed";
  licenseId?: mongoose.Types.ObjectId | string | null;
  provisioningTaskId?: mongoose.Types.ObjectId | string | null;
  commissionId?: mongoose.Types.ObjectId | string | null;
  ranAt?: Date | null;
}

export interface ISoftwarePurchase {
  purchaseNumber: string;
  userId: mongoose.Types.ObjectId | string;
  email: string;
  softwareProductId: mongoose.Types.ObjectId | string;
  productSnapshot: IPurchaseProductSnapshot;
  priceMinor: number;
  discountMinor: number;
  totalMinor: number;
  currency: "BDT";
  couponCode?: string;
  status: PurchaseStatus;
  payment: IPaymentRef;
  idempotencyKey: string;
  fulfillment: IPurchaseFulfillment;
  timeline: IPurchaseTimelineEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const purchaseSchema = new Schema<ISoftwarePurchase>(
  {
    purchaseNumber: { type: String, required: true, unique: true },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    email: { type: String, required: true, lowercase: true, trim: true },
    softwareProductId: {
      type: Schema.Types.ObjectId,
      ref: "SoftwareProduct",
      required: true,
      index: true,
    },
    productSnapshot: {
      name: { ...localizedDef },
      slug: { type: String, required: true },
      priceMinor: { type: Number, required: true },
      deliveryType: { type: String, required: true },
      externalApp: { type: String },
      affiliate: { rateBp: { type: Number } },
    },
    priceMinor: { type: Number, required: true },
    discountMinor: { type: Number, default: 0 },
    totalMinor: { type: Number, required: true },
    currency: { type: String, default: "BDT" },
    couponCode: String,
    status: {
      type: String,
      enum: ["pending", "paid", "cancelled", "refunded"],
      default: "pending",
      index: true,
    },
    payment: {
      provider: { type: String, default: "manual" },
      txnId: String,
      status: { type: String, default: "unpaid" },
      raw: Schema.Types.Mixed,
      paidAt: { type: Date, default: null },
    },
    idempotencyKey: { type: String, required: true },
    fulfillment: {
      type: { type: String, required: true },
      status: { type: String, default: "pending" },
      licenseId: { type: Schema.Types.ObjectId, ref: "License", default: null },
      provisioningTaskId: {
        type: Schema.Types.ObjectId,
        ref: "ProvisioningTask",
        default: null,
      },
      commissionId: {
        type: Schema.Types.ObjectId,
        ref: "AffiliateCommission",
        default: null,
      },
      ranAt: { type: Date, default: null },
    },
    timeline: {
      type: [
        new Schema<IPurchaseTimelineEntry>(
          { status: String, at: Date, note: String },
          { _id: false },
        ),
      ],
      default: [],
    },
  },
  { collection: "software_purchases", timestamps: true },
);

// Idempotent purchase creation: same key never creates two purchases.
purchaseSchema.index({ idempotencyKey: 1 }, { unique: true });
// "Does this user own this product (paid)?" lookups for the secure asset route.
purchaseSchema.index({ userId: 1, softwareProductId: 1, status: 1 });
purchaseSchema.index({ createdAt: -1 });

export const SoftwarePurchase: Model<ISoftwarePurchase> =
  (mongoose.models.SoftwarePurchase as Model<ISoftwarePurchase>) ??
  mongoose.model<ISoftwarePurchase>("SoftwarePurchase", purchaseSchema);
