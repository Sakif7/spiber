import { z } from "zod";
import { localizedSchema } from "./localized";
import { specSchema } from "./catalog";

/**
 * Seller-authored product (self-serve portal). Deliberately SIMPLE — no
 * variants (admin-only for now). `priceMinor` is integer poisha; the form
 * converts from taka. Created `pending` approval + `marketplace` storefront.
 */
export const sellerProductSchema = z.object({
  name: localizedSchema,
  description: localizedSchema.optional(),
  categoryId: z.string().min(1),
  priceMinor: z.number().int().positive(),
  stockQty: z.number().int().nonnegative().default(0),
  lowStockThreshold: z.number().int().nonnegative().default(5),
  images: z.array(z.string()).max(10).default([]),
  specs: z.array(specSchema).max(40).default([]),
  status: z.enum(["draft", "active"]).default("active"),
});
export type SellerProductInput = z.infer<typeof sellerProductSchema>;
