import { z } from "zod";

export const couponTypeEnum = z.enum(["percent", "fixed"]);
export type CouponType = z.infer<typeof couponTypeEnum>;

export const couponSchema = z.object({
  code: z.string().min(1).max(64),
  type: couponTypeEnum,
  // percent: 1–100; fixed: poisha amount
  value: z.number().positive(),
  minSubtotalMinor: z.number().int().nonnegative().optional(),
  usageLimit: z.number().int().positive().optional(),
  usedCount: z.number().int().nonnegative().default(0),
  expiresAt: z.coerce.date().optional(),
  active: z.boolean().default(true),
});
export type CouponInput = z.infer<typeof couponSchema>;

/** Normalize a coupon code for matching (case-insensitive, trimmed). */
export const couponCodeSchema = z.object({
  code: z.string().trim().min(1).max(64),
});
