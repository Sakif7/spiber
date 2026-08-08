import { connectToDatabase } from "@/lib/db/connect";
import {
  createProduct,
  getProductBySlug,
  getSellerProductById,
  getProductById,
} from "@/lib/repositories/products.repo";
import { getSellerById } from "@/lib/repositories/sellers.repo";
import { applyMovement } from "./inventory.service";
import { notifySellerProductModeration } from "./seller-notifications.service";
import { slugify } from "@/lib/slug";
import { makeId } from "@/lib/ids";
import { logger } from "@/lib/log";
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

/** Content fields that require re-review when changed on a LIVE listing. */
function contentChanged(doc: IProduct, input: SellerProductInput): boolean {
  const norm = (v: unknown) => JSON.stringify(v ?? null);
  return (
    norm(doc.name) !== norm(input.name) ||
    norm(doc.description ?? null) !== norm(input.description ?? null) ||
    String(doc.categoryId) !== input.categoryId ||
    norm(doc.images) !== norm(input.images) ||
    norm(doc.specs) !== norm(input.specs)
  );
}

/**
 * Update a seller's own product.
 *
 * Amazon-style moderation: on an APPROVED (live) listing, price/stock/status
 * changes apply immediately, while CONTENT changes (name, description,
 * category, images, specs) are stored as a `pendingDraft` for re-review — the
 * last-approved version keeps serving, so an edit never takes the listing
 * offline. Never-approved (pending/rejected) products update in place and
 * (re-)enter the queue. Stock deltas always route through an inventory
 * movement so the audit trail stays authoritative.
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
  const isLive = doc.approvalStatus === "approved";

  if (isLive) {
    // Immediate fields — visible price/stock changes carry no
    // misrepresentation risk and match marketplace norms.
    doc.priceMinor = input.priceMinor;
    doc.lowStockThreshold = input.lowStockThreshold;
    doc.status = input.status;

    if (contentChanged(doc.toObject(), input)) {
      doc.pendingDraft = {
        name: input.name,
        description: input.description,
        categoryId: input.categoryId,
        images: input.images,
        specs: input.specs,
        submittedAt: new Date(),
      };
      // A fresh draft supersedes any previous update-rejection note.
      doc.rejectionReason = null;
    }
  } else {
    // Not live yet — update in place and (re-)enter the review queue.
    doc.name = input.name;
    doc.description = input.description;
    doc.categoryId = input.categoryId;
    doc.priceMinor = input.priceMinor;
    doc.lowStockThreshold = input.lowStockThreshold;
    doc.images = input.images;
    doc.specs = input.specs;
    doc.status = input.status;
    doc.approvalStatus = "pending";
    doc.approvedAt = null;
    doc.rejectionReason = null;
    doc.pendingDraft = null;
  }
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

export type ModerateSellerProductResult =
  | { ok: true; product: IProduct; kind: "listing" | "update" }
  | { ok: false; code: "not_found" };

/**
 * Admin decision on a seller listing OR on a live listing's pending update.
 *
 * - New/pending listing: approve → live; reject → rejected + reason.
 * - Live listing with a pendingDraft: approve → the draft is applied to the
 *   live fields and cleared; reject → the draft is discarded, the live
 *   version keeps serving, and the reason is stored for the seller.
 *
 * Emails the seller either way (best-effort).
 */
export async function moderateSellerProduct(
  id: string,
  decision: "approved" | "rejected",
  reason?: string,
): Promise<ModerateSellerProductResult> {
  await connectToDatabase();
  const doc = await getProductById(id);
  if (!doc || !doc.sellerId) return { ok: false, code: "not_found" };

  const isUpdate = doc.approvalStatus === "approved" && !!doc.pendingDraft;
  const draft = doc.pendingDraft;

  if (isUpdate && draft) {
    if (decision === "approved") {
      doc.name = draft.name;
      doc.description = draft.description;
      doc.categoryId = draft.categoryId;
      doc.images = draft.images;
      doc.specs = draft.specs;
      doc.approvedAt = new Date();
      doc.rejectionReason = null;
    } else {
      doc.rejectionReason = reason?.trim() || null;
    }
    doc.pendingDraft = null;
  } else {
    doc.approvalStatus = decision;
    if (decision === "approved") {
      doc.approvedAt = new Date();
      doc.rejectionReason = null;
    } else {
      doc.rejectionReason = reason?.trim() || null;
    }
  }
  await doc.save();

  // Notify the seller (best-effort — a mail failure never fails the decision).
  const seller = await getSellerById(String(doc.sellerId)).catch(() => null);
  if (seller) {
    await notifySellerProductModeration(seller, doc.name.en, decision, {
      reason,
      isUpdate,
    }).catch((e) => logger.warn("moderation notify failed", e));
  }

  return {
    ok: true,
    product: doc.toObject(),
    kind: isUpdate ? "update" : "listing",
  };
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
