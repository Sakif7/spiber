import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Product, type IProduct } from "@/lib/models/product";
import { Order } from "@/lib/models/order";
import type { Lean } from "@/lib/models/_shared";
import type { ProductStatus, Storefront } from "@/lib/schemas/catalog";
import { applyPartialSearch } from "@/lib/repositories/search-filter";

// Version-agnostic Mongoose filter type (Mongoose 9 renamed FilterQuery).
type ProductFilter = NonNullable<Parameters<typeof Product.countDocuments>[0]>;

export type ProductSort = "newest" | "price_asc" | "price_desc" | "rating_desc";

export type ProductListParams = {
  storefront?: Storefront;
  categoryId?: string;
  categoryIds?: string[];
  brandId?: string;
  sellerId?: string;
  search?: string;
  minPriceMinor?: number;
  maxPriceMinor?: number;
  minRating?: number;
  inStockOnly?: boolean;
  featured?: boolean;
  /** Include seller listings awaiting/failing approval (admin/seller views only). */
  includeUnapproved?: boolean;
  status?: ProductStatus;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
};

/** Approval predicate: match house/approved products (also legacy docs lacking
 * the field). Excludes seller listings that are pending or rejected. */
const APPROVED_FILTER = { $nin: ["pending", "rejected"] } as const;

function buildQuery(params: ProductListParams): Record<string, unknown> {
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.storefront) q.storefront = params.storefront;
  if (params.status) q.status = params.status;
  if (params.featured) q.featured = true;
  if (params.categoryIds && params.categoryIds.length > 0) {
    q.categoryId = { $in: params.categoryIds };
  } else if (params.categoryId) {
    q.categoryId = params.categoryId;
  }
  if (params.brandId) q.brandId = params.brandId;
  if (params.sellerId) q.sellerId = params.sellerId;
  // Secure-by-default: public listings never show unapproved seller listings.
  if (!params.includeUnapproved) q.approvalStatus = APPROVED_FILTER;
  if (params.minRating != null) q.ratingAvg = { $gte: params.minRating };
  if (params.inStockOnly) {
    // In stock if the base product has stock OR any variant does.
    q.$or = [{ stockQty: { $gt: 0 } }, { "variants.stockQty": { $gt: 0 } }];
  }
  if (params.minPriceMinor != null || params.maxPriceMinor != null) {
    const price: Record<string, number> = {};
    if (params.minPriceMinor != null) price.$gte = params.minPriceMinor;
    if (params.maxPriceMinor != null) price.$lte = params.maxPriceMinor;
    q.priceMinor = price;
  }
  applyPartialSearch(q, params.search, [
    "name.en",
    "name.bn",
    "description.en",
    "description.bn",
    "sku",
  ]);
  return q;
}

export async function listProducts(params: ProductListParams) {
  await connectToDatabase();
  const q = buildQuery(params);
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(60, Math.max(1, params.pageSize ?? 12));
  const sort: Record<string, 1 | -1> =
    params.sort === "price_asc"
      ? { priceMinor: 1 }
      : params.sort === "price_desc"
        ? { priceMinor: -1 }
        : params.sort === "rating_desc"
          ? { ratingAvg: -1 }
          : { createdAt: -1 };

  const filter = q as unknown as ProductFilter;
  const [items, total] = await Promise.all([
    Product.find(filter)
      .sort(sort)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<Lean<IProduct>[]>()
      .exec(),
    Product.countDocuments(filter),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getProductBySlug(
  slug: string,
  storefront?: Storefront,
  includeUnapproved = false,
) {
  await connectToDatabase();
  const q: Record<string, unknown> = { slug, deletedAt: null };
  if (storefront) q.storefront = storefront;
  if (!includeUnapproved) q.approvalStatus = APPROVED_FILTER;
  return Product.findOne(q as unknown as ProductFilter)
    .lean<Lean<IProduct>>()
    .exec();
}

export async function getProductById(id: string) {
  await connectToDatabase();
  return Product.findOne({ _id: id, deletedAt: null }).exec();
}

export async function listRelatedProducts(
  categoryId: string,
  excludeId: string,
  limit = 4,
  storefront?: Storefront,
) {
  await connectToDatabase();
  const q: Record<string, unknown> = {
    categoryId,
    _id: { $ne: excludeId },
    status: "active",
    approvalStatus: APPROVED_FILTER,
    deletedAt: null,
  };
  if (storefront) q.storefront = storefront;
  return Product.find(q as unknown as ProductFilter)
    .limit(limit)
    .lean<Lean<IProduct>[]>()
    .exec();
}

/** Featured, active products for a storefront's homepage rails. */
export async function listFeaturedProducts(
  storefront: Storefront,
  limit = 8,
): Promise<Lean<IProduct>[]> {
  await connectToDatabase();
  return Product.find({
    storefront,
    featured: true,
    status: "active",
    approvalStatus: APPROVED_FILTER,
    deletedAt: null,
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<Lean<IProduct>[]>()
    .exec();
}

export async function createProduct(data: Partial<IProduct>) {
  await connectToDatabase();
  return Product.create(data);
}

export async function updateProduct(id: string, data: Partial<IProduct>) {
  await connectToDatabase();
  return Product.findOneAndUpdate({ _id: id, deletedAt: null }, data, {
    new: true,
  }).exec();
}

export async function softDeleteProduct(id: string) {
  await connectToDatabase();
  await Product.updateOne(
    { _id: id },
    { $set: { deletedAt: new Date(), status: "archived" } },
  ).exec();
}

// ── Bulk admin operations (status change / soft-delete over many products) ──

/** Minimal fields the bulk service needs to decide eligibility. */
export type BulkProductLite = Pick<
  Lean<IProduct>,
  "_id" | "status" | "priceMinor" | "variants"
>;

/**
 * Resolve the set of products a bulk action targets — either an explicit `ids`
 * list or everything matching the current list filter (`all`). Scoped to the
 * given storefront and non-deleted; capped to a sane ceiling.
 */
export async function findProductsForBulk(params: {
  storefront: Storefront;
  ids?: string[];
  status?: ProductStatus;
  search?: string;
  limit?: number;
}): Promise<BulkProductLite[]> {
  await connectToDatabase();
  const limit = Math.min(2000, Math.max(1, params.limit ?? 2000));
  let q: Record<string, unknown>;
  if (params.ids && params.ids.length > 0) {
    const ids = params.ids.filter((id) => mongoose.isValidObjectId(id));
    if (ids.length === 0) return [];
    q = { _id: { $in: ids }, storefront: params.storefront, deletedAt: null };
  } else {
    q = buildQuery({
      storefront: params.storefront,
      status: params.status,
      search: params.search,
      includeUnapproved: true, // admin bulk operates on every product
    });
  }
  return Product.find(q as unknown as ProductFilter)
    .select("_id status priceMinor variants")
    .limit(limit)
    .lean<BulkProductLite[]>()
    .exec();
}

export async function bulkSetProductStatus(
  ids: string[],
  status: ProductStatus,
): Promise<number> {
  await connectToDatabase();
  const objIds = ids.filter((id) => mongoose.isValidObjectId(id));
  if (objIds.length === 0) return 0;
  const res = await Product.updateMany(
    { _id: { $in: objIds }, deletedAt: null },
    { $set: { status } },
  ).exec();
  return res.modifiedCount ?? 0;
}

export async function bulkSoftDeleteProducts(ids: string[]): Promise<number> {
  await connectToDatabase();
  const objIds = ids.filter((id) => mongoose.isValidObjectId(id));
  if (objIds.length === 0) return 0;
  const res = await Product.updateMany(
    { _id: { $in: objIds }, deletedAt: null },
    { $set: { deletedAt: new Date(), status: "archived" } },
  ).exec();
  return res.modifiedCount ?? 0;
}

/**
 * Low-stock products (marketplace only — instruments is quote-only). Variant
 * products are low when ANY variant is at/under the product's threshold; simple
 * products when the base stock is.
 */
export async function lowStockProducts(): Promise<Lean<IProduct>[]> {
  await connectToDatabase();
  return Product.aggregate<Lean<IProduct>>([
    {
      $match: { deletedAt: null, storefront: "marketplace", status: "active" },
    },
    {
      $addFields: {
        _isLow: {
          $cond: [
            { $gt: [{ $size: "$variants" }, 0] },
            {
              $anyElementTrue: {
                $map: {
                  input: "$variants",
                  as: "v",
                  in: { $lte: ["$$v.stockQty", "$lowStockThreshold"] },
                },
              },
            },
            { $lte: ["$stockQty", "$lowStockThreshold"] },
          ],
        },
      },
    },
    { $match: { _isLow: true } },
    { $project: { _isLow: 0 } },
  ]).exec();
}

/**
 * "Frequently bought together" — real order co-occurrence. Aggregates orders
 * that contain `productId`, ranks the other products by co-purchased quantity,
 * and returns the active ones (most co-purchased first). Empty when order data
 * is thin; callers fall back to category-related products.
 */
export async function frequentlyBoughtTogether(
  productId: string,
  limit = 4,
  storefront?: Storefront,
): Promise<Lean<IProduct>[]> {
  await connectToDatabase();
  let oid: mongoose.Types.ObjectId;
  try {
    oid = new mongoose.Types.ObjectId(productId);
  } catch {
    return [];
  }
  const rows = await Order.aggregate<{
    _id: mongoose.Types.ObjectId;
    count: number;
  }>([
    { $match: { "items.productId": oid } },
    { $unwind: "$items" },
    { $match: { "items.productId": { $ne: oid } } },
    { $group: { _id: "$items.productId", count: { $sum: "$items.qty" } } },
    { $sort: { count: -1 } },
    { $limit: limit },
  ]).exec();

  const ids = rows.map((r) => r._id);
  if (!ids.length) return [];
  const q: Record<string, unknown> = {
    _id: { $in: ids },
    status: "active",
    approvalStatus: APPROVED_FILTER,
    deletedAt: null,
  };
  if (storefront) q.storefront = storefront;
  const products = await Product.find(q as unknown as ProductFilter)
    .lean<Lean<IProduct>[]>()
    .exec();
  // Preserve co-occurrence ranking.
  const byId = new Map(products.map((p) => [String(p._id), p]));
  return ids
    .map((id) => byId.get(String(id)))
    .filter((p): p is Lean<IProduct> => Boolean(p));
}

// ── Seller-owned products ──

export async function listSellerProducts(
  sellerId: string,
  params: { status?: ProductStatus; page?: number; pageSize?: number } = {},
) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(sellerId))
    return { items: [], total: 0, page: 1, pageSize: 20, pages: 1 };
  const q: Record<string, unknown> = { sellerId, deletedAt: null };
  if (params.status) q.status = params.status;
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(60, Math.max(1, params.pageSize ?? 20));
  const filter = q as unknown as ProductFilter;
  const [items, total] = await Promise.all([
    Product.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<Lean<IProduct>[]>()
      .exec(),
    Product.countDocuments(filter),
  ]);
  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function countSellerProducts(
  sellerId: string,
  status?: ProductStatus,
): Promise<number> {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(sellerId)) return 0;
  const q: Record<string, unknown> = { sellerId, deletedAt: null };
  if (status) q.status = status;
  return Product.countDocuments(q as unknown as ProductFilter);
}

/** A product owned by this seller (edit/guard); null if not theirs. */
export async function getSellerProductById(sellerId: string, id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(sellerId))
    return null;
  return Product.findOne({ _id: id, sellerId, deletedAt: null }).exec();
}

/** Lean read of a seller-owned product (for the edit-form prefill). */
export async function getSellerProductByIdLean(sellerId: string, id: string) {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(sellerId))
    return null;
  return Product.findOne({ _id: id, sellerId, deletedAt: null })
    .lean<Lean<IProduct>>()
    .exec();
}

/** Seller listings awaiting admin approval (approval board). */
export async function listPendingSellerProducts() {
  await connectToDatabase();
  return Product.find({ approvalStatus: "pending", deletedAt: null })
    .sort({ createdAt: 1 })
    .lean<Lean<IProduct>[]>()
    .exec();
}

export async function countPendingSellerProducts(): Promise<number> {
  await connectToDatabase();
  return Product.countDocuments({
    approvalStatus: "pending",
    deletedAt: null,
  } as unknown as ProductFilter);
}

export async function setProductApproval(
  id: string,
  status: "approved" | "rejected",
  reason?: string,
) {
  await connectToDatabase();
  const update: Record<string, unknown> = { approvalStatus: status };
  if (status === "approved") {
    update.approvedAt = new Date();
    update.rejectionReason = null;
  }
  if (status === "rejected") update.rejectionReason = reason ?? null;
  return Product.findOneAndUpdate(
    { _id: id, deletedAt: null },
    { $set: update },
    { new: true },
  )
    .lean<Lean<IProduct>>()
    .exec();
}
