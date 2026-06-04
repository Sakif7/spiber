import mongoose, { Schema, type Model } from "mongoose";
import type { CouponType, CouponScope } from "@/lib/schemas/coupon";

export interface ICoupon {
  code: string;
  type: CouponType;
  value: number;
  minSubtotalMinor?: number;
  usageLimit?: number;
  usedCount: number;
  appliesTo: CouponScope;
  expiresAt?: Date | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const couponSchema = new Schema<ICoupon>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    type: { type: String, enum: ["percent", "fixed"], required: true },
    value: { type: Number, required: true, min: 0 },
    minSubtotalMinor: { type: Number, min: 0 },
    usageLimit: { type: Number, min: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    appliesTo: {
      type: String,
      enum: ["all", "instruments", "marketplace", "academy", "systems"],
      default: "all",
    },
    expiresAt: { type: Date, default: null },
    active: { type: Boolean, default: true, index: true },
  },
  { collection: "coupons", timestamps: true },
);

export const Coupon: Model<ICoupon> =
  (mongoose.models.Coupon as Model<ICoupon>) ??
  mongoose.model<ICoupon>("Coupon", couponSchema);
