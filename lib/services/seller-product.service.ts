import { connectToDatabase } from "@/lib/db/connect";
import {
  createProduct,
  getProductBySlug,
  getSellerProductById,
} from "@/lib/repositories/products.repo";
import { applyMovement } from "./inventory.service";
import { slugify } from "@/lib/slug";
import { makeId } from "@/lib/ids";
import type { IProduct } from "@/lib/models/product";
import type { SellerProductInput } from "@/lib/schemas/seller-product";

async function uniqueSlug(nameEn: string): Promise<string> {
  const base = slugify(nameEn);
  // Check against ALL products (incl. pending) so slugs never collide.
  const existing = await getProductBySlug(base, undefined, true);
  return existing ? `${base}-${Date.now().toString(36).slice(-4)}` : base;
}

/** Create a seller-owned product (pending approval, marketplace storefront).
 * Returns the new product id. */
export async function createSellerProduct(
  sellerId: string,
  actorUserId: string,
  input: SellerProductInput,
): Promise<string> {
  await connectToDatabase();
  const slug = await uniqueSlug(input.name.en);
  const product = await createProduct({
    sku: makeId("SEL"),
    name: input.name,
    slug,
    description: input.description,
    categoryId: input.categoryId,
    storefront: "marketplace",
    specs: input.specs,
    images: input.images,
    priceMinor: input.priceMinor,
    stockQty: 0,
    lowStockThreshold: input.lowStockThreshold,
    status: input.status,
    sellerId,
    approvalStatus: "pending",
    variantOptions: [],
    variants: [],
  });
  if (input.stockQty > 0) {
    await applyMovement({
      productId: String(product._id),
      variantId: null,
      type: "adjustment",
      qtyDelta: input.stockQty,
      reason: "seller_initial_stock",
      createdBy: actorUserId,
    });
  }
  return String(product._id);
}

export type UpdateSellerProductResult =
  | { ok: true; product: IProduct }
  | { ok: false; code: "not_found" };

/**
 * Update a seller's own product. A content edit re-enters the approval queue
 * (guards against bait-and-switch on an approved listing). Stock deltas are
 * routed through an inventory movement so the audit trail stays authoritative.
 */
export async function updateSellerProduct(
  sellerId: string,
  actorUserId: string,
  id: string,
  input: SellerProductInput,
): Promise<UpdateSellerProductResult> {
  await connectToDatabase();
  const doc = await getSellerProductById(sellerId, id);
  if (!doc) return { ok: false, code: "not_found" };

  const currentStock = doc.stockQty;
  doc.name = input.name;
  doc.description = input.description;
  doc.categoryId = input.categoryId;
  doc.priceMinor = input.priceMinor;
  doc.lowStockThreshold = input.lowStockThreshold;
  doc.images = input.images;
  doc.specs = input.specs;
  doc.status = input.status;
  // Re-review on edit.
  doc.approvalStatus = "pending";
  doc.approvedAt = null;
  doc.rejectionReason = null;
  await doc.save();

  if (input.stockQty !== currentStock) {
    await applyMovement({
      productId: id,
      variantId: null,
      type: "adjustment",
      qtyDelta: input.stockQty - currentStock,
      reason: "seller_adjustment",
      createdBy: actorUserId,
    });
    doc.stockQty = input.stockQty;
  }
  return { ok: true, product: doc.toObject() };
}

export async function softDeleteSellerProduct(
  sellerId: string,
  id: string,
): Promise<{ ok: boolean }> {
  await connectToDatabase();
  const doc = await getSellerProductById(sellerId, id);
  if (!doc) return { ok: false };
  doc.deletedAt = new Date();
  doc.status = "archived";
  await doc.save();
  return { ok: true };
}
