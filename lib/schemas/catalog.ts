import { z } from "zod";
import { localizedSchema } from "./localized";

/**
 * Catalog entities: Brand, Category, Product — shared by Spiber Medtrade
 * (quote-only) and Spiber Marketplace (full commerce). Zod is the single source
 * of truth; Mongoose models + TS types derive from it. Money is integer poisha.
 * Localized fields are { en, bn }.
 */

export const productStatusEnum = z.enum(["draft", "active", "archived"]);
export type ProductStatus = z.infer<typeof productStatusEnum>;

/**
 * Approval gate for third-party (seller-owned) products. House/admin products
 * default to "approved"; a seller's product starts "pending" and is hidden from
 * public listings until an admin approves it.
 */
export const productApprovalEnum = z.enum(["pending", "approved", "rejected"]);
export type ProductApprovalStatus = z.infer<typeof productApprovalEnum>;

/**
 * Which storefront a product/category belongs to. `instruments` = B2B
 * quote-only catalog (no cart/checkout, price optional). `marketplace` = the
 * buyable multi-category store (full commerce engine).
 */
export const storefrontEnum = z.enum(["instruments", "marketplace"]);
export type Storefront = z.infer<typeof storefrontEnum>;

// ---- Brand ----
// `slug` is optional on input; the route derives it from `name.en` when blank.
export const brandSchema = z.object({
  name: localizedSchema,
  slug: z.string().max(120).optional(),
  logo: z.string().optional(),
});
export type BrandInput = z.infer<typeof brandSchema>;

/** Manual up/down reorder payload for the admin brand list. */
export const brandReorderSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().min(1),
        position: z.number().int().nonnegative(),
      }),
    )
    .min(1)
    .max(2000),
});
export type BrandReorderInput = z.infer<typeof brandReorderSchema>;

// ---- Category ----
// `slug` is optional on input; the route derives it from `name.en` when blank.
// Categories form a per-storefront tree via `parentId`; `position` orders
// siblings; admin manages the tree.
export const categorySchema = z.object({
  name: localizedSchema,
  slug: z.string().max(120).optional(),
  parentId: z.string().optional().nullable(),
  image: z.string().optional(),
  storefront: storefrontEnum.default("marketplace"),
  description: localizedSchema.optional(),
  position: z.number().int().nonnegative().default(0),
  featured: z.boolean().default(false),
  icon: z.string().max(60).optional(),
});
export type CategoryInput = z.infer<typeof categorySchema>;

/** Drag-reorder / reparent payload for the admin category tree manager. */
export const categoryReorderSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().min(1),
        parentId: z.string().nullable().optional(),
        position: z.number().int().nonnegative(),
      }),
    )
    .min(1)
    .max(500),
});
export type CategoryReorderInput = z.infer<typeof categoryReorderSchema>;

// ---- Product ----
export const specSchema = z.object({
  key: localizedSchema,
  value: localizedSchema,
});

/**
 * A variant OPTION dimension, e.g. name="Size" with values ["S","M","L"].
 * Localized so the storefront can render Bangla labels.
 */
export const variantOptionSchema = z.object({
  name: localizedSchema,
  values: z.array(localizedSchema).min(1),
});
export type VariantOptionInput = z.infer<typeof variantOptionSchema>;

/**
 * A concrete purchasable variant — one combination of option values, with its
 * own sku, optional price override (falls back to the product base price), and
 * its own stock (the atomic decrement target). `id` is server-assigned.
 * `options` uses language-neutral English keys for matching.
 */
export const productVariantSchema = z.object({
  id: z.string().optional(),
  options: z
    .array(z.object({ name: z.string().min(1), value: z.string().min(1) }))
    .min(1),
  sku: z.string().min(1).max(64),
  priceMinorOverride: z.number().int().nonnegative().nullable().default(null),
  stockQty: z.number().int().nonnegative().default(0),
  image: z.string().optional(),
});
export type ProductVariantInput = z.infer<typeof productVariantSchema>;

export const productSchema = z.object({
  sku: z.string().min(1).max(64),
  name: localizedSchema,
  // `slug` is optional on input; the route derives it from `name.en` when blank.
  slug: z.string().max(160).optional(),
  description: localizedSchema.optional(),
  brandId: z.string().optional(),
  categoryId: z.string().min(1),
  storefront: storefrontEnum.default("marketplace"),
  specs: z.array(specSchema).default([]),
  images: z.array(z.string()).default([]),
  // Optional: instruments products are "Price on request"; marketplace
  // products must resolve a price (enforced by `refineProduct`).
  priceMinor: z.number().int().nonnegative().nullable().optional(),
  // Optional "was"/RRP price. When set above `priceMinor`, storefronts show a
  // strikethrough + "Sale" badge (the saving = compareAt − price).
  compareAtMinor: z.number().int().nonnegative().nullable().optional(),
  // Optional negotiation floor (Medtrade). When set below `priceMinor` the
  // storefront shows "৳floor – ৳list" as a negotiable range and the RFQ pipeline
  // tells admins how far they may discount. Never charged automatically —
  // checkout always bills the list price.
  floorPriceMinor: z.number().int().nonnegative().nullable().optional(),
  stockQty: z.number().int().default(0),
  lowStockThreshold: z.number().int().nonnegative().default(5),
  // Stock-tracking override: null/absent = default rule (Kart always tracked,
  // Medtrade tracked once priced); true/false forces it either way.
  trackStock: z.boolean().nullable().optional(),
  status: productStatusEnum.default("draft"),
  featured: z.boolean().default(false),
  variantOptions: z.array(variantOptionSchema).default([]),
  variants: z.array(productVariantSchema).default([]),
});
export type ProductInput = z.infer<typeof productSchema>;

/**
 * Cross-field price rule. Instruments products may have no price ("Price on
 * request"). Marketplace products must resolve a price: either a base price (no
 * variants) or, when variants exist, every variant must resolve a price from
 * its override or the base price. Skips when storefront is absent (PATCH).
 */
export function refineProduct(
  p: {
    storefront?: Storefront;
    priceMinor?: number | null;
    floorPriceMinor?: number | null;
    variants?: { priceMinorOverride?: number | null }[];
  },
  ctx: z.RefinementCtx,
): void {
  // Floor-price rules apply to EVERY storefront, so they sit ABOVE the
  // marketplace-only early-out below (the floor is a Medtrade feature, and
  // instruments would otherwise skip validation entirely).
  if (p.floorPriceMinor != null) {
    if (p.priceMinor == null) {
      ctx.addIssue({
        code: "custom",
        path: ["floorPriceMinor"],
        message: "a floor price requires a list price",
      });
    } else if (p.floorPriceMinor > p.priceMinor) {
      ctx.addIssue({
        code: "custom",
        path: ["floorPriceMinor"],
        message: "floor price must not exceed the list price",
      });
    }
  }

  if (p.storefront !== "marketplace") return; // instruments: price optional
  const variants = p.variants ?? [];
  if (variants.length === 0) {
    if (p.priceMinor == null) {
      ctx.addIssue({
        code: "custom",
        path: ["priceMinor"],
        message: "price is required for marketplace products",
      });
    }
    return;
  }
  const baseOk = p.priceMinor != null;
  variants.forEach((v, i) => {
    if (v.priceMinorOverride == null && !baseOk) {
      ctx.addIssue({
        code: "custom",
        path: ["variants", i, "priceMinorOverride"],
        message: "set a price for this variant, or a base product price",
      });
    }
  });
}

/** Admin create input — base `stockQty` is managed via InventoryMovement. */
export const productInputSchema = productSchema
  .omit({ stockQty: true })
  .superRefine(refineProduct);
export type ProductFormInput = z.infer<typeof productInputSchema>;

/** Admin update input — partial; the route forces `storefront` per section. */
export const productUpdateSchema = productSchema
  .omit({ stockQty: true })
  .partial()
  .superRefine(refineProduct);
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

/**
 * Bulk admin action over many products — status change or soft-delete from the
 * product list, without opening each one. Either an explicit `ids` list OR
 * `all: true` to act on every product matching the current list filter
 * (storefront + optional status/search), so an admin can e.g. activate every
 * draft in one go.
 */
export const productBulkActionEnum = z.enum([
  "activate",
  "draft",
  "archive",
  "delete",
]);
export type ProductBulkAction = z.infer<typeof productBulkActionEnum>;

export const productBulkSchema = z
  .object({
    action: productBulkActionEnum,
    storefront: storefrontEnum,
    ids: z.array(z.string().min(1)).max(1000).optional(),
    all: z.boolean().optional(),
    status: productStatusEnum.optional(), // current filter (only with `all`)
    search: z.string().max(120).optional(), // current filter (only with `all`)
  })
  .refine((d) => d.all === true || (d.ids?.length ?? 0) > 0, {
    message: "Select at least one product",
    path: ["ids"],
  });
export type ProductBulkInput = z.infer<typeof productBulkSchema>;
