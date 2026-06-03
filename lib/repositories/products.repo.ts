import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Product, type IProduct } from "@/lib/models/product";
import { Order } from "@/lib/models/order";
import type { Lean } from "@/lib/models/_shared";
import type { ProductStatus } from "@/lib/schemas/catalog";
import { applyPartialSearch } from "@/lib/repositories/search-filter";

// Version-agnostic Mongoose filter type (Mongoose 9 renamed FilterQuery).
type ProductFilter = NonNullable<Parameters<typeof Product.countDocuments>[0]>;

export type ProductSort = "newest" | "price_asc" | "price_desc";

export type ProductListParams = {
  categoryId?: string;
  brandId?: string;
  search?: string;
  minPriceMinor?: number;
  maxPriceMinor?: number;
  inStockOnly?: boolean;
  status?: ProductStatus;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
};

function buildQuery(params: ProductListParams): Record<string, unknown> {
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  if (params.categoryId) q.categoryId = params.categoryId;
  if (params.brandId) q.brandId = params.brandId;
  if (params.inStockOnly) q.stockQty = { $gt: 0 };
  if (params.minPriceMinor != null || params.maxPriceMinor != null) {
    const price: Record<string, number> = {};
    if (params.minPriceMinor != null) price.$gte = params.minPriceMinor;
    if (params.maxPriceMinor != null) price.$lte = params.maxPriceMinor;
    q.priceMinor = price;
  }
  applyPartialSearch(q, params.search, ["name.en", "name.bn", "sku"]);
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

export async function getProductBySlug(slug: string) {
  await connectToDatabase();
  return Product.findOne({ slug, deletedAt: null })
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
) {
  await connectToDatabase();
  return Product.find({
    categoryId,
    _id: { $ne: excludeId },
    status: "active",
    deletedAt: null,
  })
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
  return Product.findByIdAndUpdate(id, data, { new: true }).exec();
}

export async function softDeleteProduct(id: string) {
  await connectToDatabase();
  await Product.updateOne(
    { _id: id },
    { $set: { deletedAt: new Date(), status: "archived" } },
  ).exec();
}

export async function lowStockProducts() {
  await connectToDatabase();
  return Product.find({
    deletedAt: null,
    $expr: { $lte: ["$stockQty", "$lowStockThreshold"] },
  })
    .lean<Lean<IProduct>[]>()
    .exec();
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
  const products = await Product.find({
    _id: { $in: ids },
    status: "active",
    deletedAt: null,
  })
    .lean<Lean<IProduct>[]>()
    .exec();
  // Preserve co-occurrence ranking.
  const byId = new Map(products.map((p) => [String(p._id), p]));
  return ids
    .map((id) => byId.get(String(id)))
    .filter((p): p is Lean<IProduct> => Boolean(p));
}
