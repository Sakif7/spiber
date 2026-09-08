import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Product, type IProduct } from "@/lib/models/product";
import { Order } from "@/lib/models/order";
import type { Lean } from "@/lib/models/_shared";
import type { ProductStatus, Storefront } from "@/lib/schemas/catalog";
import { applyPartialSearch } from "@/lib/repositories/search-filter";
import {
  applyDateRange,
  paginate,
  sortSpec,
  type RepoListQuery,
} from "./list-query";
import {
  STOCK_EXPR,
  TRACKED_EXPR,
  AVAILABLE_EXPR,
} from "@/lib/inventory/tracking";

// Version-agnostic Mongoose filter type (Mongoose 9 renamed FilterQuery).
type ProductFilter = NonNullable<Parameters<typeof Product.countDocuments>[0]>;

export type ProductSort =
  | "newest"
  | "price_asc"
  | "price_desc"
  | "rating_desc"
  | "name_asc"
  | "name_desc";

export type ProductListParams = {
  storefront?: Storefront;
  categoryId?: string;
  categoryIds?: string[];
  brandId?: string;
  /** Multi-select brand facet (OR within the facet). Wins over `brandId`. */
  brandIds?: string[];
  sellerId?: string;
  search?: string;
  minPriceMinor?: number;
  maxPriceMinor?: number;
  minRating?: number;
  inStockOnly?: boolean;
  /** Only genuinely discounted products (compareAtMinor > priceMinor). */
  onSale?: boolean;
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

/** Suspended-seller predicate: `$ne: true` also matches legacy docs lacking
 * the flag, so house/pre-existing products are unaffected. */
const NOT_SUSPENDED = { $ne: true } as const;

/** The full public-visibility gate for seller listings — spread into every
 * public query alongside status/deletedAt. */
const PUBLIC_SELLER_GATE = {
  approvalStatus: APPROVED_FILTER,
  sellerSuspended: NOT_SUSPENDED,
} as const;

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
  if (params.brandIds && params.brandIds.length > 0) {
    q.brandId = {
      $in: params.brandIds.filter((id) => mongoose.isValidObjectId(id)),
    };
  } else if (params.brandId) {
    q.brandId = params.brandId;
  }
  if (params.sellerId) q.sellerId = params.sellerId;
  // Secure-by-default: public listings never show unapproved seller listings
  // or listings of a suspended seller.
  if (!params.includeUnapproved) {
    q.approvalStatus = APPROVED_FILTER;
    q.sellerSuspended = NOT_SUSPENDED;
  }
  if (params.minRating != null) q.ratingAvg = { $gte: params.minRating };
  if (params.inStockOnly) {
    // In stock if the base product has stock OR any variant does.
    // "In stock" means a shopper can actually buy it, so reserved units do
    // not count. Needs $expr because it compares two fields of the document.
    q.$expr = { $gt: [AVAILABLE_EXPR, 0] };
  }
  if (params.onSale) {
    // A genuine discount: an admin-entered compare-at above the current price.
    q.$expr = {
      $and: [
        { $gt: ["$compareAtMinor", 0] },
        { $gt: ["$priceMinor", 0] },
        { $gt: ["$compareAtMinor", "$priceMinor"] },
      ],
    };
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
  const SORTS: Record<ProductSort, Record<string, 1 | -1>> = {
    newest: { createdAt: -1 },
    price_asc: { priceMinor: 1, _id: -1 },
    price_desc: { priceMinor: -1, _id: -1 },
    rating_desc: { ratingAvg: -1, _id: -1 },
    name_asc: { "name.en": 1, _id: -1 },
    name_desc: { "name.en": -1, _id: -1 },
  };
  const sort: Record<string, 1 | -1> = SORTS[params.sort ?? "newest"];

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

/** Facet data for the filter sidebar. Each facet's numbers are computed with
 * every OTHER active filter applied (standard faceted-search semantics), so a
 * count always answers "how many results would I get if I picked this?". */
export type ProductFacets = {
  /** brandId → matching product count (with all non-brand filters applied). */
  brandCounts: Record<string, number>;
  /** categoryId → count (with the category filter itself removed). Callers
   * roll leaf counts up to their top-level categories via the tree. */
  categoryCounts: Record<string, number>;
  /** Global price bounds (minor units) for the slider, ignoring the current
   * price filter; null when nothing in the result set carries a price. */
  priceMinMinor: number | null;
  priceMaxMinor: number | null;
  inStockCount: number;
  onSaleCount: number;
  /** "N stars & up" counts (with the rating filter itself removed). */
  ratingCounts: { r2: number; r3: number; r4: number };
};

export async function getProductFacets(
  params: ProductListParams,
): Promise<ProductFacets> {
  await connectToDatabase();
  const base = (over: Partial<ProductListParams>) =>
    buildQuery({ ...params, page: undefined, pageSize: undefined, ...over });

  const [
    brandRows,
    categoryRows,
    priceRows,
    inStockCount,
    onSaleCount,
    ratingRows,
  ] = await Promise.all([
    Product.aggregate<{ _id: mongoose.Types.ObjectId | null; n: number }>([
      { $match: base({ brandId: undefined, brandIds: undefined }) },
      { $group: { _id: "$brandId", n: { $sum: 1 } } },
    ]).exec(),
    Product.aggregate<{ _id: mongoose.Types.ObjectId | null; n: number }>([
      { $match: base({ categoryId: undefined, categoryIds: undefined }) },
      { $group: { _id: "$categoryId", n: { $sum: 1 } } },
    ]).exec(),
    Product.aggregate<{ _id: null; lo: number; hi: number }>([
      {
        $match: {
          ...base({ minPriceMinor: undefined, maxPriceMinor: undefined }),
          priceMinor: { $ne: null },
        },
      },
      {
        $group: {
          _id: null,
          lo: { $min: "$priceMinor" },
          hi: { $max: "$priceMinor" },
        },
      },
    ]).exec(),
    Product.countDocuments(
      base({ inStockOnly: true }) as unknown as ProductFilter,
    ),
    Product.countDocuments(base({ onSale: true }) as unknown as ProductFilter),
    Product.aggregate<{ _id: null; r2: number; r3: number; r4: number }>([
      { $match: base({ minRating: undefined }) },
      {
        $group: {
          _id: null,
          r2: { $sum: { $cond: [{ $gte: ["$ratingAvg", 2] }, 1, 0] } },
          r3: { $sum: { $cond: [{ $gte: ["$ratingAvg", 3] }, 1, 0] } },
          r4: { $sum: { $cond: [{ $gte: ["$ratingAvg", 4] }, 1, 0] } },
        },
      },
    ]).exec(),
  ]);

  const brandCounts: Record<string, number> = {};
  for (const r of brandRows) {
    if (r._id) brandCounts[String(r._id)] = r.n;
  }
  const categoryCounts: Record<string, number> = {};
  for (const r of categoryRows) {
    if (r._id) categoryCounts[String(r._id)] = r.n;
  }
  return {
    brandCounts,
    categoryCounts,
    priceMinMinor: priceRows[0]?.lo ?? null,
    priceMaxMinor: priceRows[0]?.hi ?? null,
    inStockCount,
    onSaleCount,
    ratingCounts: {
      r2: ratingRows[0]?.r2 ?? 0,
      r3: ratingRows[0]?.r3 ?? 0,
      r4: ratingRows[0]?.r4 ?? 0,
    },
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
  if (!includeUnapproved) Object.assign(q, PUBLIC_SELLER_GATE);
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
    ...PUBLIC_SELLER_GATE,
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
    ...PUBLIC_SELLER_GATE,
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
                  in: {
                    $lte: [
                      {
                        $subtract: [
                          { $ifNull: ["$$v.stockQty", 0] },
                          { $ifNull: ["$$v.reservedQty", 0] },
                        ],
                      },
                      "$lowStockThreshold",
                    ],
                  },
                },
              },
            },
            {
              $lte: [
                {
                  $subtract: [
                    { $ifNull: ["$stockQty", 0] },
                    { $ifNull: ["$reservedQty", 0] },
                  ],
                },
                "$lowStockThreshold",
              ],
            },
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
    ...PUBLIC_SELLER_GATE,
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

/** One-pass state summary for the seller dashboard. */
export async function sellerProductStateCounts(sellerId: string): Promise<{
  total: number;
  live: number;
  pendingReview: number;
  updatesInReview: number;
  rejected: number;
  lowStock: { id: string; name: string; stockQty: number }[];
}> {
  const empty = {
    total: 0,
    live: 0,
    pendingReview: 0,
    updatesInReview: 0,
    rejected: 0,
    lowStock: [] as { id: string; name: string; stockQty: number }[],
  };
  await connectToDatabase();
  if (!mongoose.isValidObjectId(sellerId)) return empty;
  const docs = await Product.find({ sellerId, deletedAt: null })
    .select(
      "name approvalStatus pendingDraft stockQty reservedQty lowStockThreshold status",
    )
    .lean<Lean<IProduct>[]>()
    .exec();
  const out = { ...empty, lowStock: [] as typeof empty.lowStock };
  for (const p of docs) {
    out.total++;
    if (p.approvalStatus === "approved") {
      out.live++;
      if (p.pendingDraft) out.updatesInReview++;
    } else if (p.approvalStatus === "pending") out.pendingReview++;
    else if (p.approvalStatus === "rejected") out.rejected++;
    if (
      p.approvalStatus === "approved" &&
      p.status === "active" &&
      p.stockQty <= p.lowStockThreshold
    ) {
      out.lowStock.push({
        id: String(p._id),
        name: p.name.en,
        stockQty: p.stockQty,
      });
    }
  }
  out.lowStock.sort((a, b) => a.stockQty - b.stockQty);
  out.lowStock = out.lowStock.slice(0, 6);
  return out;
}

/**
 * Denormalize a seller's suspension onto their products so every public query
 * can exclude them with a cheap indexed predicate (no join per read).
 */
export async function setSellerProductsSuspended(
  sellerId: string,
  suspended: boolean,
): Promise<number> {
  await connectToDatabase();
  if (!mongoose.isValidObjectId(sellerId)) return 0;
  const res = await Product.updateMany(
    { sellerId },
    { $set: { sellerSuspended: suspended } },
  ).exec();
  return res.modifiedCount ?? 0;
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

/** The moderation queue: NEW seller listings (approvalStatus pending) plus
 * LIVE listings whose seller submitted a content UPDATE (pendingDraft set). */
export async function listPendingSellerProducts() {
  await connectToDatabase();
  return Product.find({
    deletedAt: null,
    $or: [{ approvalStatus: "pending" }, { pendingDraft: { $ne: null } }],
  })
    .sort({ createdAt: 1 })
    .lean<Lean<IProduct>[]>()
    .exec();
}

/** Sort keys the seller-approval board exposes → stored fields. */
const PENDING_PRODUCT_SORT: Record<string, string> = {
  date: "createdAt",
  name: "name.en",
  price: "priceMinor",
};

export type PendingSellerProductListParams = RepoListQuery & {
  /** "new" = first submission, "update" = an approved listing with a draft. */
  kind?: "new" | "update";
};

/** Paged, searchable version of the approval queue (list kit). Same
 * predicate as listPendingSellerProducts. */
export async function listPendingSellerProductsForAdmin(
  params: PendingSellerProductListParams = {},
) {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.kind === "new") q.approvalStatus = "pending";
  else if (params.kind === "update") q.pendingDraft = { $ne: null };
  else q.$or = [{ approvalStatus: "pending" }, { pendingDraft: { $ne: null } }];
  applyPartialSearch(q, params.search, [
    "name.en",
    "sku",
    "pendingDraft.name.en",
  ]);
  applyDateRange(q, params.from, params.to);
  return paginate<IProduct>(Product, q, {
    sort: sortSpec(params.sort, params.dir, PENDING_PRODUCT_SORT, {
      key: "date",
      dir: "asc",
    }),
    page: params.page,
    pageSize: params.pageSize,
  });
}

export async function countPendingSellerProducts(): Promise<number> {
  await connectToDatabase();
  return Product.countDocuments({
    deletedAt: null,
    $or: [{ approvalStatus: "pending" }, { pendingDraft: { $ne: null } }],
  } as unknown as ProductFilter);
}

/**
 * Active products whose on-hand stock is at or below their low-stock threshold.
 * Stock = the sum of variant quantities when a product has variants, else its
 * base quantity. Only TRACKED products count: every Spiber Kart product, and
 * Medtrade products that carry a price (quotation-only instruments have no
 * stock concept, so they must not read as "low").
 */
export async function countLowStockProducts(
  storefront?: Storefront,
): Promise<number> {
  await connectToDatabase();
  const match: Record<string, unknown> = { deletedAt: null, status: "active" };
  if (storefront) match.storefront = storefront;
  const rows = await Product.aggregate<{ n: number }>([
    { $match: match },
    {
      $addFields: { _stock: STOCK_EXPR, _tracked: TRACKED_EXPR },
    },
    {
      $match: {
        _tracked: true,
        $expr: { $lte: ["$_stock", { $ifNull: ["$lowStockThreshold", 0] }] },
      },
    },
    { $count: "n" },
  ]);
  return rows[0]?.n ?? 0;
}

export type LowStockRow = {
  id: string;
  name: string;
  sku: string;
  storefront: Storefront;
  stock: number;
  threshold: number;
};

/**
 * The lowest-stock TRACKED active products at or below their threshold (same
 * tracking rule as countLowStockProducts), for the dashboard's low-stock list.
 */
export async function listLowStockProducts(limit = 6): Promise<LowStockRow[]> {
  await connectToDatabase();
  const rows = await Product.aggregate<{
    _id: unknown;
    name?: { en?: string };
    sku?: string;
    storefront: Storefront;
    _stock: number;
    lowStockThreshold?: number;
  }>([
    { $match: { deletedAt: null, status: "active" } },
    {
      $addFields: { _stock: STOCK_EXPR, _tracked: TRACKED_EXPR },
    },
    {
      $match: {
        _tracked: true,
        $expr: { $lte: ["$_stock", { $ifNull: ["$lowStockThreshold", 0] }] },
      },
    },
    { $sort: { _stock: 1, "name.en": 1 } },
    { $limit: Math.max(1, Math.min(50, limit)) },
    {
      $project: {
        name: 1,
        sku: 1,
        storefront: 1,
        _stock: 1,
        lowStockThreshold: 1,
      },
    },
  ]);
  return rows.map((r) => ({
    id: String(r._id),
    name: r.name?.en ?? "",
    sku: r.sku ?? "",
    storefront: r.storefront,
    stock: r._stock,
    threshold: r.lowStockThreshold ?? 0,
  }));
}
