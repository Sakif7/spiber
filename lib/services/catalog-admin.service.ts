import { variantId as genVariantId } from "@/lib/ids";
import { slugify } from "@/lib/slug";
import {
  createProduct,
  getProductById,
  updateProduct,
  findProductsForBulk,
  bulkSetProductStatus,
  bulkSoftDeleteProducts,
  type BulkProductLite,
} from "@/lib/repositories/products.repo";
import { applyMovement } from "./inventory.service";
import type {
  ProductFormInput,
  ProductBulkInput,
  ProductStatus,
} from "@/lib/schemas/catalog";
import type { IProduct, IProductVariant } from "@/lib/models/product";

/**
 * Product create/update for the admin, shared by Instruments (quote) and
 * Marketplace. Variant stock is the source-of-truth `Product.variants[].stockQty`
 * but every change is routed through `applyMovement` so the InventoryMovement
 * audit trail stays authoritative (and the array-replace never silently clobbers
 * stock that orders have decremented):
 *  - the variants array is written with each variant's CURRENT stock (0 for new),
 *  - then a movement applies the delta to reach the admin-entered target.
 */

type StockOp = {
  variantId: string;
  type: "purchase" | "adjustment";
  delta: number;
};

export async function createCatalogProduct(
  input: ProductFormInput,
  actorId?: string,
) {
  const ops: StockOp[] = [];
  const variants: IProductVariant[] = (input.variants ?? []).map((v) => {
    const id = v.id || genVariantId();
    if ((v.stockQty ?? 0) > 0)
      ops.push({ variantId: id, type: "purchase", delta: v.stockQty });
    return {
      id,
      options: v.options,
      sku: v.sku,
      priceMinorOverride: v.priceMinorOverride ?? null,
      stockQty: 0, // movements below bring it to the target
      image: v.image,
    };
  });

  const data: Partial<IProduct> = {
    ...input,
    slug: slugify(input.slug || input.name.en),
    priceMinor: input.priceMinor ?? null,
    floorPriceMinor: input.floorPriceMinor ?? null,
    stockQty: 0,
    variants,
  };
  const doc = await createProduct(data);
  for (const op of ops) {
    await applyMovement({
      productId: String(doc._id),
      variantId: op.variantId,
      type: op.type,
      qtyDelta: op.delta,
      reason: "initial_stock",
      createdBy: actorId,
    });
  }
  return doc;
}

export async function updateCatalogProduct(
  id: string,
  input: ProductFormInput,
  actorId?: string,
) {
  const current = await getProductById(id);
  if (!current) return null;
  const currentStock = new Map(
    (current.variants ?? []).map((v) => [v.id, v.stockQty]),
  );

  const ops: StockOp[] = [];
  const variants: IProductVariant[] = (input.variants ?? []).map((v) => {
    const existing = v.id ? currentStock.get(v.id) : undefined;
    if (v.id && existing != null) {
      const delta = (v.stockQty ?? 0) - existing;
      if (delta !== 0) ops.push({ variantId: v.id, type: "adjustment", delta });
      return {
        id: v.id,
        options: v.options,
        sku: v.sku,
        priceMinorOverride: v.priceMinorOverride ?? null,
        stockQty: existing, // preserved; movement applies the delta
        image: v.image,
      };
    }
    const id = v.id || genVariantId();
    if ((v.stockQty ?? 0) > 0)
      ops.push({ variantId: id, type: "purchase", delta: v.stockQty });
    return {
      id,
      options: v.options,
      sku: v.sku,
      priceMinorOverride: v.priceMinorOverride ?? null,
      stockQty: 0,
      image: v.image,
    };
  });

  const data: Partial<IProduct> = {
    ...input,
    slug: slugify(input.slug || input.name.en),
    priceMinor: input.priceMinor ?? null,
    variants,
  };
  // `floorPriceMinor` rides the spread above: sending `null` clears it, omitting
  // the key preserves it (so the marketplace form can't wipe a Medtrade floor).
  // Base stockQty is managed via Inventory, never clobbered by the product form.
  delete (data as { stockQty?: number }).stockQty;

  const doc = await updateProduct(id, data);
  if (!doc) return null;
  for (const op of ops) {
    await applyMovement({
      productId: id,
      variantId: op.variantId,
      type: op.type,
      qtyDelta: op.delta,
      reason: op.type === "purchase" ? "initial_stock" : "variant_adjustment",
      createdBy: actorId,
    });
  }
  return doc;
}

/**
 * A marketplace product can only go `active` if it resolves a price (mirrors
 * `refineProduct`): a base price, or — when it has variants — every variant
 * carries an override (or the base price covers them). Instruments are
 * quote-only so price is optional. Prevents a bulk-activate from publishing a
 * price-less marketplace product that would break the storefront.
 */
function canActivate(
  storefront: ProductBulkInput["storefront"],
  p: BulkProductLite,
) {
  if (storefront !== "marketplace") return true;
  const variants = p.variants ?? [];
  if (variants.length === 0) return p.priceMinor != null;
  return variants.every(
    (v) => v.priceMinorOverride != null || p.priceMinor != null,
  );
}

export type BulkResult = {
  matched: number;
  modified: number;
  skipped: number;
};

/**
 * Bulk status change / soft-delete over many products. Targets either an
 * explicit `ids` list or everything matching the current list filter (`all`).
 * Returns how many matched, were modified, and were skipped (marketplace
 * products that can't be activated without a price).
 */
export async function bulkUpdateProducts(
  input: ProductBulkInput,
): Promise<BulkResult> {
  const candidates = await findProductsForBulk({
    storefront: input.storefront,
    ids: input.all ? undefined : input.ids,
    status: input.status,
    search: input.search,
  });
  const matched = candidates.length;
  let ids = candidates.map((c) => String(c._id));

  if (input.action === "delete") {
    const modified = await bulkSoftDeleteProducts(ids);
    return { matched, modified, skipped: 0 };
  }

  const status: ProductStatus =
    input.action === "activate"
      ? "active"
      : input.action === "draft"
        ? "draft"
        : "archived";

  let skipped = 0;
  if (status === "active") {
    const eligible = candidates.filter((c) => canActivate(input.storefront, c));
    skipped = candidates.length - eligible.length;
    ids = eligible.map((c) => String(c._id));
  }

  const modified = await bulkSetProductStatus(ids, status);
  return { matched, modified, skipped };
}
