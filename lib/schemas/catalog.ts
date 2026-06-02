import { z } from "zod";
import { localizedSchema } from "./localized";

/**
 * Catalog entities for Spiber Instruments: Brand, Category, Product.
 * Zod is the single source of truth; Mongoose models + TS types derive from it.
 * Money is integer poisha. Localized fields are { en, bn }.
 */

export const productStatusEnum = z.enum(["draft", "active", "archived"]);
export type ProductStatus = z.infer<typeof productStatusEnum>;

// ---- Brand ----
// `slug` is optional on input; the route derives it from `name.en` when blank.
export const brandSchema = z.object({
  name: localizedSchema,
  slug: z.string().max(120).optional(),
  logo: z.string().optional(),
});
export type BrandInput = z.infer<typeof brandSchema>;

// ---- Category ----
// `slug` is optional on input; the route derives it from `name.en` when blank.
export const categorySchema = z.object({
  name: localizedSchema,
  slug: z.string().max(120).optional(),
  parentId: z.string().optional(),
  image: z.string().optional(),
});
export type CategoryInput = z.infer<typeof categorySchema>;

// ---- Product ----
export const specSchema = z.object({
  key: localizedSchema,
  value: localizedSchema,
});

export const productSchema = z.object({
  sku: z.string().min(1).max(64),
  name: localizedSchema,
  // `slug` is optional on input; the route derives it from `name.en` when blank.
  slug: z.string().max(160).optional(),
  description: localizedSchema.optional(),
  brandId: z.string().optional(),
  categoryId: z.string().min(1),
  specs: z.array(specSchema).default([]),
  images: z.array(z.string()).default([]),
  priceMinor: z.number().int().nonnegative(),
  stockQty: z.number().int().default(0),
  lowStockThreshold: z.number().int().nonnegative().default(5),
  status: productStatusEnum.default("draft"),
});
export type ProductInput = z.infer<typeof productSchema>;

/** Admin create/update input — stockQty is managed via InventoryMovement, not edited directly. */
export const productInputSchema = productSchema.omit({ stockQty: true });
export type ProductFormInput = z.infer<typeof productInputSchema>;
