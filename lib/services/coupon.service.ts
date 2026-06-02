import { getCouponByCode } from "@/lib/repositories/coupons.repo";
import type { CouponType } from "@/lib/schemas/coupon";

export type ValidatedCoupon = {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  minSubtotalMinor?: number;
};

export type CouponResult =
  | { ok: true; coupon: ValidatedCoupon }
  | {
      ok: false;
      reason:
        | "not_found"
        | "inactive"
        | "expired"
        | "usage_limit"
        | "min_subtotal";
    };

export async function validateCoupon(
  code: string,
  subtotalMinor: number,
  now: Date = new Date(),
): Promise<CouponResult> {
  const c = await getCouponByCode(code);
  if (!c) return { ok: false, reason: "not_found" };
  if (!c.active) return { ok: false, reason: "inactive" };
  if (c.expiresAt && c.expiresAt < now) return { ok: false, reason: "expired" };
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) {
    return { ok: false, reason: "usage_limit" };
  }
  if (c.minSubtotalMinor != null && subtotalMinor < c.minSubtotalMinor) {
    return { ok: false, reason: "min_subtotal" };
  }
  return {
    ok: true,
    coupon: {
      id: String(c._id),
      code: c.code,
      type: c.type,
      value: c.value,
      minSubtotalMinor: c.minSubtotalMinor,
    },
  };
}
