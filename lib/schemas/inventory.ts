import { z } from "zod";

export const movementTypeEnum = z.enum([
  "purchase",
  "sale",
  "adjustment",
  "return",
]);
export type MovementType = z.infer<typeof movementTypeEnum>;

/** Movement types an admin may record by hand ("sale" only comes from orders). */
export const manualMovementTypeEnum = z.enum([
  "adjustment",
  "purchase",
  "return",
]);
export type ManualMovementType = z.infer<typeof manualMovementTypeEnum>;

/**
 * Where a movement came from — machine provenance kept apart from the
 * free-text `reason` an admin types. Orders and product saves keep writing
 * their legacy machine reasons; the ledger labels both.
 */
export const movementSourceEnum = z.enum([
  "manual",
  "set",
  "bulk",
  "csv",
  "override",
]);
export type MovementSource = z.infer<typeof movementSourceEnum>;

const unitRef = {
  productId: z.string().min(1),
  /** Target one `Product.variants[].id`; omit to adjust the base stock. */
  variantId: z.string().min(1).optional(),
};

const reason = z.string().trim().max(500).optional();

/** Admin manual stock adjustment input (a delta). */
export const adjustStockSchema = z.object({
  ...unitRef,
  qtyDelta: z
    .number()
    .int()
    .refine((n) => n !== 0, "qtyDelta cannot be zero"),
  type: manualMovementTypeEnum.default("adjustment"),
  reason,
  /** Required to change a SELLER-managed unit; the seller is notified. */
  override: z.boolean().optional(),
});
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

/** "Set to N": the service computes the delta atomically. */
export const setStockSchema = z.object({
  ...unitRef,
  targetQty: z.number().int().min(0).max(1_000_000),
  reason,
  override: z.boolean().optional(),
});
export type SetStockInput = z.infer<typeof setStockSchema>;

/** Many units at once (bulk receive / CSV import); lines apply independently. */
export const bulkAdjustSchema = z.object({
  type: manualMovementTypeEnum.default("purchase"),
  reason,
  override: z.boolean().optional(),
  source: z.enum(["bulk", "csv"]).default("bulk"),
  lines: z
    .array(
      z.object({
        ...unitRef,
        qtyDelta: z
          .number()
          .int()
          .refine((n) => n !== 0, "qtyDelta cannot be zero"),
        reason,
      }),
    )
    .min(1)
    .max(500),
});
export type BulkAdjustInput = z.infer<typeof bulkAdjustSchema>;

/** CSV preview: resolve the file's SKUs to stock units before applying. */
export const csvPreviewSchema = z.object({
  text: z.string().min(1).max(200_000),
});

/** Force stock tracking on/off for a product (null = back to the default rule). */
export const trackStockSchema = z.object({
  productId: z.string().min(1),
  trackStock: z.boolean().nullable(),
});
export type TrackStockInput = z.infer<typeof trackStockSchema>;
