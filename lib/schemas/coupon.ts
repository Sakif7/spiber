import { z } from "zod";

export const couponTypeEnum = z.enum(["percent", "fixed"]);
export type CouponType = z.infer<typeof couponTypeEnum>;

// Where a coupon may be redeemed. `all` = anywhere (default, backward-compatible).
export const couponScopeEnum = z.enum([
  "all",
  "instruments",
  "marketplace",
  "academy",
  "systems",
]);
export type CouponScope = z.infer<typeof couponScopeEnum>;

export const couponSchema = z.object({
  code: z.string().min(1).max(64),
  type: couponTypeEnum,
  // percent: 1–100; fixed: poisha amount (integer)
  value: z.number().positive(),
  minSubtotalMinor: z.number().int().nonnegative().optional(),
  usageLimit: z.number().int().positive().optional(),
  usedCount: z.number().int().nonnegative().default(0),
  appliesTo: couponScopeEnum.default("all"),
  expiresAt: z.coerce.date().optional(),
  active: z.boolean().default(true),
});
export type CouponInput = z.infer<typeof couponSchema>;

/**
 * Cross-field rule shared by create + partial-update validation: a percent
 * coupon's value must be 1–100; a fixed coupon's value must be whole poisha.
 * Skips checks when the relevant field is absent (so it composes with PATCH).
 */
export function refineCouponValue(
  c: { type?: CouponType; value?: number },
  ctx: z.RefinementCtx,
): void {
  if (c.type === undefined || c.value === undefined) return;
  if (c.type === "percent" && (c.value < 1 || c.value > 100)) {
    ctx.addIssue({
      code: "custom",
      path: ["value"],
      message: "percent value must be between 1 and 100",
    });
  }
  if (c.type === "fixed" && !Number.isInteger(c.value)) {
    ctx.addIssue({
      code: "custom",
      path: ["value"],
      message: "fixed discount must be a whole number (poisha)",
    });
  }
}

/** Full-object validation for creating a coupon. */
export const couponCreateSchema = couponSchema.superRefine(refineCouponValue);

/** Partial validation for updating a coupon (still enforces the value rule). */
export const couponUpdateSchema = couponSchema
  .partial()
  .superRefine(refineCouponValue);

/** Normalize a coupon code for matching (case-insensitive, trimmed). */
export const couponCodeSchema = z.object({
  code: z.string().trim().min(1).max(64),
});
