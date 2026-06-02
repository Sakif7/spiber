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

export async function incrementCouponUsage(id: string) {
  await connectToDatabase();
  await Coupon.updateOne({ _id: id }, { $inc: { usedCount: 1 } }).exec();
}
