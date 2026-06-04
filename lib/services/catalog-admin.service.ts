import { variantId as genVariantId } from "@/lib/ids";
import { slugify } from "@/lib/slug";
import {
  createProduct,
  getProductById,
  updateProduct,
} from "@/lib/repositories/products.repo";
import { applyMovement } from "./inventory.service";
import type { ProductFormInput } from "@/lib/schemas/catalog";
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
