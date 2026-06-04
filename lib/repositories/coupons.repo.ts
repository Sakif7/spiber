import { connectToDatabase } from "@/lib/db/connect";
import { Coupon, type ICoupon } from "@/lib/models/coupon";
import type { Lean } from "@/lib/models/_shared";

export async function getCouponByCode(code: string) {
  await connectToDatabase();
  return Coupon.findOne({ code: code.trim().toUpperCase() }).exec();
}

export async function listCoupons() {
  await connectToDatabase();
  return Coupon.find({}).sort({ createdAt: -1 }).lean<Lean<ICoupon>[]>().exec();
}

export async function createCoupon(data: Partial<ICoupon>) {
  await connectToDatabase();
  return Coupon.create(data);
}

export async function updateCoupon(id: string, data: Partial<ICoupon>) {
  await connectToDatabase();
  return Coupon.findByIdAndUpdate(id, data, { new: true }).exec();
}

/**
 * @deprecated Non-atomic; kept only for the academy/systems flows pending their
 * migration to {@link reserveCouponUsage}. Do not use in new code.
 */
export async function incrementCouponUsage(id: string) {
  await connectToDatabase();
  await Coupon.updateOne({ _id: id }, { $inc: { usedCount: 1 } }).exec();
}

/**
 * Atomically claim one redemption slot. Returns false (without incrementing)
 * when the usage limit is already reached — this closes the check-then-increment
 * race where two concurrent checkouts both passed validation. Coupons with no
 * usageLimit are unlimited.
 */
export async function reserveCouponUsage(id: string): Promise<boolean> {
  await connectToDatabase();
  const res = await Coupon.updateOne(
    {
      _id: id,
      $or: [
        { usageLimit: null },
        { usageLimit: { $exists: false } },
        { $expr: { $lt: ["$usedCount", "$usageLimit"] } },
      ],
    },
    { $inc: { usedCount: 1 } },
  ).exec();
  return res.modifiedCount === 1;
}

/** Give a claimed redemption slot back (e.g. order cancelled/refunded). Never goes below 0. */
export async function releaseCouponUsage(id: string): Promise<void> {
  await connectToDatabase();
  await Coupon.updateOne(
    { _id: id, usedCount: { $gt: 0 } },
    { $inc: { usedCount: -1 } },
  ).exec();
}

/** Release a redemption slot by coupon code (used on cancel/refund where only the code is stored). */
export async function releaseCouponUsageByCode(code: string): Promise<void> {
  await connectToDatabase();
  await Coupon.updateOne(
    { code: code.trim().toUpperCase(), usedCount: { $gt: 0 } },
    { $inc: { usedCount: -1 } },
  ).exec();
}
