import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import {
  InventoryMovement,
  type IInventoryMovement,
} from "@/lib/models/inventoryMovement";
import { Product } from "@/lib/models/product";
import type { Lean } from "@/lib/models/_shared";
import type { ProductStatus, Storefront } from "@/lib/schemas/catalog";
import type { MovementType } from "@/lib/schemas/inventory";
import {
  TRACKED_EXPR,
  isStockTracked,
  stockLevel,
  variantLabel,
  type StockLevel,
} from "@/lib/inventory/tracking";
import {
  EMPTY_PAGE,
  applyDateRange,
  applyPartialSearch,
  paginate,
  sortSpec,
  type Paged,
  type RepoListQuery,
} from "./list-query";

export async function createMovement(data: Partial<IInventoryMovement>) {
  await connectToDatabase();
  return InventoryMovement.create(data);
}

export async function listMovementsByProduct(productId: string, limit = 100) {
  await connectToDatabase();
  return InventoryMovement.find({ productId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean<Lean<IInventoryMovement>[]>()
    .exec();
}

// ───────────────────────── Stock units (the hub) ─────────────────────────

/**
 * One stock unit: a simple product's base stock, or one variant of a
 * product-with-variants (the parent itself holds no stock of its own).
 */
export type StockUnit = {
  /** `productId` or `productId:variantId`. */
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  /** e.g. "L · Black" for a variant. */
  variantLabel: string | null;
  sku: string;
  slug: string;
  storefront: Storefront;
  status: ProductStatus;
  categoryId: string | null;
  brandId: string | null;
  sellerId: string | null;
  tracked: boolean;
  trackStock: boolean | null;
  /** Unit price in poisha (variant override, else the base price); null = price on request. */
  priceMinor: number | null;
  stock: number;
  threshold: number;
  /** null when the unit is not tracked. */
  level: StockLevel | null;
  image: string | null;
  updatedAt: string;
};

export type StockUnitSort = "stock" | "name" | "sku" | "updated" | "value";

export type StockUnitListParams = {
  storefront?: Storefront;
  search?: string;
  categoryIds?: string[];
  brandId?: string;
  /** house = platform products; seller = third-party listings. */
  owner?: "house" | "seller";
  tracked?: boolean;
  level?: StockLevel | StockLevel[];
  /** Default: every non-archived product. */
  status?: ProductStatus;
  sort?: StockUnitSort;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type StockUnitPage = {
  items: StockUnit[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
};

export type StockKpis = {
  trackedUnits: number;
  untrackedUnits: number;
  low: number;
  out: number;
  /** Σ stock × unit price over tracked units (poisha). */
  stockValueMinor: number;
};

type RawUnit = {
  _id: mongoose.Types.ObjectId;
  name?: { en?: string };
  slug?: string;
  storefront: Storefront;
  status: ProductStatus;
  categoryId?: mongoose.Types.ObjectId | null;
  brandId?: mongoose.Types.ObjectId | null;
  sellerId?: mongoose.Types.ObjectId | null;
  trackStock?: boolean | null;
  priceMinor?: number | null;
  lowStockThreshold?: number;
  updatedAt?: Date;
  _tracked: boolean;
  _level: StockLevel | null;
  _units: {
    variantId: string | null;
    options: { name: string; value: string }[] | null;
    sku: string;
    stock: number;
    price: number | null;
    image: string | null;
  };
};

function productMatch(params: StockUnitListParams): Record<string, unknown> {
  const q: Record<string, unknown> = { deletedAt: null };
  if (params.status) q.status = params.status;
  else q.status = { $ne: "archived" };
  if (params.storefront) q.storefront = params.storefront;
  if (params.categoryIds && params.categoryIds.length > 0) {
    q.categoryId = {
      $in: params.categoryIds
        .filter((id) => mongoose.isValidObjectId(id))
        .map((id) => new mongoose.Types.ObjectId(id)),
    };
  }
  if (params.brandId && mongoose.isValidObjectId(params.brandId)) {
    q.brandId = new mongoose.Types.ObjectId(params.brandId);
  }
  if (params.owner === "house") q.sellerId = null;
  if (params.owner === "seller") q.sellerId = { $ne: null };
  applyPartialSearch(q, params.search, ["name.en", "sku", "variants.sku"]);
  return q;
}

/** Explode products into stock units with `_tracked` / `_level` computed. */
function unitStages(match: Record<string, unknown>): mongoose.PipelineStage[] {
  return [
    { $match: match },
    { $addFields: { _tracked: TRACKED_EXPR } },
    {
      $project: {
        name: 1,
        slug: 1,
        sku: 1,
        storefront: 1,
        status: 1,
        categoryId: 1,
        brandId: 1,
        sellerId: 1,
        trackStock: 1,
        priceMinor: 1,
        lowStockThreshold: 1,
        stockQty: 1,
        variants: 1,
        images: 1,
        updatedAt: 1,
        _tracked: 1,
      },
    },
    {
      $addFields: {
        _units: {
          $cond: [
            { $gt: [{ $size: { $ifNull: ["$variants", []] } }, 0] },
            {
              $map: {
                input: "$variants",
                as: "v",
                in: {
                  variantId: "$$v.id",
                  options: "$$v.options",
                  sku: "$$v.sku",
                  stock: { $ifNull: ["$$v.stockQty", 0] },
                  price: { $ifNull: ["$$v.priceMinorOverride", "$priceMinor"] },
                  image: {
                    $ifNull: ["$$v.image", { $arrayElemAt: ["$images", 0] }],
                  },
                },
              },
            },
            [
              {
                variantId: null,
                options: null,
                sku: "$sku",
                stock: { $ifNull: ["$stockQty", 0] },
                price: "$priceMinor",
                image: { $arrayElemAt: ["$images", 0] },
              },
            ],
          ],
        },
      },
    },
    { $unwind: "$_units" },
    {
      $addFields: {
        _level: {
          $cond: [
            "$_tracked",
            {
              $cond: [
                { $lte: ["$_units.stock", 0] },
                "out",
                {
                  $cond: [
                    {
                      $lte: [
                        "$_units.stock",
                        { $ifNull: ["$lowStockThreshold", 0] },
                      ],
                    },
                    "low",
                    "ok",
                  ],
                },
              ],
            },
            null,
          ],
        },
        _value: {
          $multiply: ["$_units.stock", { $ifNull: ["$_units.price", 0] }],
        },
      },
    },
  ] as unknown as mongoose.PipelineStage[];
}

const UNIT_SORTS: Record<StockUnitSort, string> = {
  stock: "_units.stock",
  name: "name.en",
  sku: "_units.sku",
  updated: "updatedAt",
  value: "_value",
};

function toUnit(r: RawUnit): StockUnit {
  const u = r._units;
  const threshold = Number(r.lowStockThreshold ?? 0);
  const stock = Number(u.stock ?? 0);
  return {
    key: u.variantId ? `${String(r._id)}:${u.variantId}` : String(r._id),
    productId: String(r._id),
    variantId: u.variantId ?? null,
    name: r.name?.en ?? "",
    variantLabel: u.options ? variantLabel(u.options) : null,
    sku: u.sku ?? "",
    slug: r.slug ?? "",
    storefront: r.storefront,
    status: r.status,
    categoryId: r.categoryId ? String(r.categoryId) : null,
    brandId: r.brandId ? String(r.brandId) : null,
    sellerId: r.sellerId ? String(r.sellerId) : null,
    tracked: Boolean(r._tracked),
    trackStock: r.trackStock ?? null,
    priceMinor: u.price ?? null,
    stock,
    threshold,
    level: r._tracked ? stockLevel(stock, threshold) : null,
    image: u.image ?? null,
    updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : "",
  };
}

export async function listStockUnits(
  params: StockUnitListParams = {},
): Promise<StockUnitPage> {
  await connectToDatabase();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, params.pageSize ?? 50));
  const stages = unitStages(productMatch(params));
  const post: Record<string, unknown> = {};
  if (params.tracked !== undefined) post._tracked = params.tracked;
  if (params.level) {
    post._level = Array.isArray(params.level)
      ? { $in: params.level }
      : params.level;
  }
  if (Object.keys(post).length > 0) {
    stages.push({ $match: post } as mongoose.PipelineStage);
  }

  const dir = params.dir === "asc" ? 1 : -1;
  const sortField = UNIT_SORTS[params.sort ?? "updated"];
  const sort: Record<string, 1 | -1> = { [sortField]: dir };
  if (sortField !== "_id") sort._id = 1;
  sort["_units.variantId"] = 1;

  const [facet] = await Product.aggregate<{
    rows: RawUnit[];
    total: { n: number }[];
  }>([
    ...stages,
    {
      $facet: {
        rows: [
          { $sort: sort },
          { $skip: (page - 1) * pageSize },
          { $limit: pageSize },
        ],
        total: [{ $count: "n" }],
      },
    },
  ] as unknown as mongoose.PipelineStage[]);
  const total = facet?.total[0]?.n ?? 0;
  return {
    items: (facet?.rows ?? []).map(toUnit),
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** KPI strip over the ACTIVE catalog (optionally one store). */
export async function stockKpis(storefront?: Storefront): Promise<StockKpis> {
  await connectToDatabase();
  const match: Record<string, unknown> = { deletedAt: null, status: "active" };
  if (storefront) match.storefront = storefront;
  const [row] = await Product.aggregate<StockKpis>([
    ...unitStages(match),
    {
      $group: {
        _id: null,
        trackedUnits: { $sum: { $cond: ["$_tracked", 1, 0] } },
        untrackedUnits: { $sum: { $cond: ["$_tracked", 0, 1] } },
        low: { $sum: { $cond: [{ $eq: ["$_level", "low"] }, 1, 0] } },
        out: { $sum: { $cond: [{ $eq: ["$_level", "out"] }, 1, 0] } },
        stockValueMinor: {
          $sum: { $cond: ["$_tracked", { $max: ["$_value", 0] }, 0] },
        },
      },
    },
    { $project: { _id: 0 } },
  ] as unknown as mongoose.PipelineStage[]);
  return (
    row ?? {
      trackedUnits: 0,
      untrackedUnits: 0,
      low: 0,
      out: 0,
      stockValueMinor: 0,
    }
  );
}

/** Resolve CSV SKUs (case-insensitive) to stock units; unknown SKUs are absent. */
export async function resolveUnitsBySku(
  skus: string[],
): Promise<Record<string, StockUnit>> {
  await connectToDatabase();
  const wanted = [...new Set(skus.map((s) => s.trim()).filter(Boolean))];
  if (wanted.length === 0) return {};
  const patterns = wanted.map(
    (s) => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
  );
  const rows = await Product.find({
    deletedAt: null,
    $or: [{ sku: { $in: patterns } }, { "variants.sku": { $in: patterns } }],
  })
    .select(
      "name slug sku storefront status categoryId brandId sellerId trackStock priceMinor lowStockThreshold stockQty variants images updatedAt",
    )
    .lean<
      {
        _id: mongoose.Types.ObjectId;
        name?: { en?: string };
        slug?: string;
        sku: string;
        storefront: Storefront;
        status: ProductStatus;
        categoryId?: mongoose.Types.ObjectId | null;
        brandId?: mongoose.Types.ObjectId | null;
        sellerId?: mongoose.Types.ObjectId | null;
        trackStock?: boolean | null;
        priceMinor?: number | null;
        lowStockThreshold?: number;
        stockQty?: number;
        images?: string[];
        updatedAt?: Date;
        variants?: {
          id: string;
          sku: string;
          stockQty?: number;
          priceMinorOverride?: number | null;
          image?: string;
          options: { name: string; value: string }[];
        }[];
      }[]
    >()
    .exec();

  const byLower = new Map(wanted.map((s) => [s.toLowerCase(), s]));
  const out: Record<string, StockUnit> = {};
  for (const p of rows) {
    const tracked = isStockTracked(p);
    const threshold = Number(p.lowStockThreshold ?? 0);
    const common = {
      productId: String(p._id),
      name: p.name?.en ?? "",
      slug: p.slug ?? "",
      storefront: p.storefront,
      status: p.status,
      categoryId: p.categoryId ? String(p.categoryId) : null,
      brandId: p.brandId ? String(p.brandId) : null,
      sellerId: p.sellerId ? String(p.sellerId) : null,
      tracked,
      trackStock: p.trackStock ?? null,
      threshold,
      updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : "",
    };
    const variants = p.variants ?? [];
    if (variants.length > 0) {
      for (const v of variants) {
        const key = byLower.get(v.sku.toLowerCase());
        if (!key) continue;
        const stock = Number(v.stockQty ?? 0);
        out[key] = {
          ...common,
          key: `${common.productId}:${v.id}`,
          variantId: v.id,
          variantLabel: variantLabel(v.options),
          sku: v.sku,
          priceMinor: v.priceMinorOverride ?? p.priceMinor ?? null,
          stock,
          level: tracked ? stockLevel(stock, threshold) : null,
          image: v.image ?? p.images?.[0] ?? null,
        };
      }
    } else {
      const key = byLower.get(p.sku.toLowerCase());
      if (!key) continue;
      const stock = Number(p.stockQty ?? 0);
      out[key] = {
        ...common,
        key: common.productId,
        variantId: null,
        variantLabel: null,
        sku: p.sku,
        priceMinor: p.priceMinor ?? null,
        stock,
        level: tracked ? stockLevel(stock, threshold) : null,
        image: p.images?.[0] ?? null,
      };
    }
  }
  return out;
}

// ───────────────────────── Movements (the ledger) ─────────────────────────

const MOVEMENT_SORT: Record<string, string> = {
  date: "createdAt",
  qty: "qtyDelta",
  type: "type",
};

export type MovementListParams = RepoListQuery & {
  productId?: string;
  variantId?: string | null;
  type?: MovementType;
  source?: string;
  refOrderId?: string;
  createdBy?: string;
};

/** Product ids whose name or SKU (base or variant) matches a search term. */
export async function findProductIdsBySearch(
  search: string,
  limit = 500,
): Promise<string[]> {
  await connectToDatabase();
  const q: Record<string, unknown> = { deletedAt: null };
  applyPartialSearch(q, search, ["name.en", "sku", "variants.sku"]);
  const rows = await Product.find(q)
    .select("_id")
    .limit(limit)
    .lean<{ _id: mongoose.Types.ObjectId }[]>()
    .exec();
  return rows.map((r) => String(r._id));
}

export async function listMovementsForAdmin(
  params: MovementListParams = {},
): Promise<Paged<IInventoryMovement>> {
  await connectToDatabase();
  const q: Record<string, unknown> = {};
  if (params.productId && mongoose.isValidObjectId(params.productId)) {
    q.productId = new mongoose.Types.ObjectId(params.productId);
    if (params.variantId !== undefined) q.variantId = params.variantId;
  } else if (params.search) {
    const ids = await findProductIdsBySearch(params.search);
    if (ids.length === 0)
      return EMPTY_PAGE<IInventoryMovement>(params.pageSize);
    q.productId = { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) };
  }
  if (params.type) q.type = params.type;
  if (params.source) q.source = params.source;
  if (params.refOrderId && mongoose.isValidObjectId(params.refOrderId)) {
    q.refOrderId = new mongoose.Types.ObjectId(params.refOrderId);
  }
  if (params.createdBy && mongoose.isValidObjectId(params.createdBy)) {
    q.createdBy = new mongoose.Types.ObjectId(params.createdBy);
  }
  applyDateRange(q, params.from, params.to);
  return paginate<IInventoryMovement>(InventoryMovement, q, {
    sort: sortSpec(params.sort, params.dir, MOVEMENT_SORT),
    page: params.page,
    pageSize: params.pageSize,
    maxPageSize: 200,
  });
}

/** Every movement matching the filter (capped) — for the CSV export. */
export async function listMovementsForExport(
  params: Omit<MovementListParams, "page" | "pageSize">,
  limit = 5000,
): Promise<Lean<IInventoryMovement>[]> {
  const res = await listMovementsForAdmin({
    ...params,
    page: 1,
    pageSize: 200,
  });
  if (res.total <= 200) return res.items;
  await connectToDatabase();
  const q: Record<string, unknown> = {};
  // Re-run the same filter without paging (the list call validated the ids).
  if (params.productId && mongoose.isValidObjectId(params.productId)) {
    q.productId = new mongoose.Types.ObjectId(params.productId);
    if (params.variantId !== undefined) q.variantId = params.variantId;
  } else if (params.search) {
    const ids = await findProductIdsBySearch(params.search);
    q.productId = { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) };
  }
  if (params.type) q.type = params.type;
  if (params.source) q.source = params.source;
  if (params.refOrderId && mongoose.isValidObjectId(params.refOrderId)) {
    q.refOrderId = new mongoose.Types.ObjectId(params.refOrderId);
  }
  if (params.createdBy && mongoose.isValidObjectId(params.createdBy)) {
    q.createdBy = new mongoose.Types.ObjectId(params.createdBy);
  }
  applyDateRange(q, params.from, params.to);
  return InventoryMovement.find(q)
    .sort(sortSpec(params.sort, params.dir, MOVEMENT_SORT))
    .limit(limit)
    .lean<Lean<IInventoryMovement>[]>()
    .exec();
}

export type LatestMovement = {
  at: string;
  type: MovementType;
  qtyDelta: number;
};

/** The most recent movement per (product, variant) for a page of units. */
export async function latestMovementsByUnits(
  units: { productId: string; variantId: string | null }[],
): Promise<Record<string, LatestMovement>> {
  await connectToDatabase();
  const ids = [...new Set(units.map((u) => u.productId))].filter((id) =>
    mongoose.isValidObjectId(id),
  );
  if (ids.length === 0) return {};
  const rows = await InventoryMovement.aggregate<{
    _id: { productId: mongoose.Types.ObjectId; variantId: string | null };
    at: Date;
    type: MovementType;
    qtyDelta: number;
  }>([
    {
      $match: {
        productId: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: { productId: "$productId", variantId: "$variantId" },
        at: { $first: "$createdAt" },
        type: { $first: "$type" },
        qtyDelta: { $first: "$qtyDelta" },
      },
    },
  ]);
  const out: Record<string, LatestMovement> = {};
  for (const r of rows) {
    const key = r._id.variantId
      ? `${String(r._id.productId)}:${r._id.variantId}`
      : String(r._id.productId);
    out[key] = {
      at: new Date(r.at).toISOString(),
      type: r.type,
      qtyDelta: r.qtyDelta,
    };
  }
  return out;
}

// ───────────────────────── Labels for ledger rows ─────────────────────────

export type ProductUnitLabels = {
  name: string;
  sku: string;
  storefront: Storefront;
  variants: Record<string, { sku: string; label: string }>;
};

/** Product + variant labels for a set of product ids (ledger / export rows). */
export async function productUnitLabelsByIds(
  ids: string[],
): Promise<Record<string, ProductUnitLabels>> {
  await connectToDatabase();
  const valid = [...new Set(ids)].filter((id) => mongoose.isValidObjectId(id));
  if (valid.length === 0) return {};
  const rows = await Product.find({ _id: { $in: valid } })
    .select("name sku storefront variants.id variants.sku variants.options")
    .lean<
      {
        _id: mongoose.Types.ObjectId;
        name?: { en?: string };
        sku: string;
        storefront: Storefront;
        variants?: {
          id: string;
          sku: string;
          options: { name: string; value: string }[];
        }[];
      }[]
    >()
    .exec();
  const out: Record<string, ProductUnitLabels> = {};
  for (const p of rows) {
    out[String(p._id)] = {
      name: p.name?.en ?? "",
      sku: p.sku,
      storefront: p.storefront,
      variants: Object.fromEntries(
        (p.variants ?? []).map((v) => [
          v.id,
          { sku: v.sku, label: variantLabel(v.options) },
        ]),
      ),
    };
  }
  return out;
}
