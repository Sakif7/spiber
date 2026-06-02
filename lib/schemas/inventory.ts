import { z } from "zod";

export const movementTypeEnum = z.enum([
  "purchase",
  "sale",
  "adjustment",
  "return",
]);
export type MovementType = z.infer<typeof movementTypeEnum>;

/** Admin manual stock adjustment input. */
export const adjustStockSchema = z.object({
  productId: z.string().min(1),
  qtyDelta: z
    .number()
    .int()
    .refine((n) => n !== 0, "qtyDelta cannot be zero"),
  reason: z.string().trim().max(500).optional(),
});
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
