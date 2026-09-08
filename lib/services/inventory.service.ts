import { connectToDatabase } from "@/lib/db/connect";
import { Product, type IProduct } from "@/lib/models/product";
import { InventoryMovement } from "@/lib/models/inventoryMovement";
import type { Lean } from "@/lib/models/_shared";
import { listMovementsByProduct } from "@/lib/repositories/inventory.repo";
import { getSellerById } from "@/lib/repositories/sellers.repo";
import { localize } from "@/lib/schemas/localized";
import type {
  AdjustStockInput,
  BulkAdjustInput,
  MovementType,
  SetStockInput,
} from "@/lib/schemas/inventory";
import {
  isStockTracked,
  unitStock,
  unitReserved,
  variantLabel,
} from "@/lib/inventory/tracking";
import { notifyAdmins } from "./notification.service";
import { notifySellerStockOverride } from "./seller-notifications.service";
import { logger } from "@/lib/log";

export class InsufficientStockError extends Error {
  constructor(public productId: string) {
    super(`Insufficient stock for product ${productId}`);
    this.name = "InsufficientStockError";
  }
}

/** The unit's stock changed underneath an optimistic (set-to-N) update. */
export class StockChangedError extends Error {
  constructor(public productId: string) {
    super(`Stock changed concurrently for product ${productId}`);
    this.name = "StockChangedError";
  }
}

export class UnitNotFoundError extends Error {
  constructor(public productId: string) {
    super(`Stock unit not found for product ${productId}`);
    this.name = "UnitNotFoundError";
  }
}

/** A seller-managed unit was adjusted without the explicit override flag. */
export class SellerManagedError extends Error {
  constructor(public productId: string) {
    super(`Product ${productId} stock is managed by its seller`);
    this.name = "SellerManagedError";
  }
}

export type MovementInput = {
  productId: string;
  /** When set, the change targets the matching Product.variants[].id element. */
  variantId?: string | null;
  type: MovementType;
  qtyDelta: number; // negative = decrement (e.g. sale)
  reason?: string;
  /** Machine provenance for admin-made changes (manual | set | bulk | csv | override). */
  source?: string | null;
  refOrderId?: string;
  /** The sales order this reservation belongs to (reserve/release/deliver). */
  refSalesOrderId?: string;
  /** Change to the reserved quantity; `qtyDelta` stays the change to on-hand. */
  reservedDelta?: number;
  createdBy?: string;
  /**
   * Optimistic guard: only apply when the unit's current stock equals this
   * value (used by "set to N"); otherwise `StockChangedError`.
   */
  expectedStock?: number;
};

export type MovementResult = {
  stockAfter: number | null;
  reservedAfter?: number | null;
};

/** The slice of a product the movement service needs after an update. */
type ProductLite = Pick<
  IProduct,
  | "name"
  | "sku"
  | "storefront"
  | "status"
  | "priceMinor"
  | "trackStock"
  | "lowStockThreshold"
  | "stockQty"
  | "reservedQty"
  | "sellerId"
> & {
  variants?: {
    id: string;
    sku: string;
    stockQty: number;
    reservedQty?: number;
    options: { name: string; value: string }[];
  }[];
};

const LITE_PROJECTION =
  "name sku storefront status priceMinor trackStock lowStockThreshold stockQty reservedQty sellerId variants.id variants.sku variants.stockQty variants.reservedQty variants.options";

async function loadProductLite(
  productId: string,
): Promise<Lean<ProductLite> | null> {
  return Product.findOne({ _id: productId, deletedAt: null })
    .select(LITE_PROJECTION)
    .lean<Lean<ProductLite>>()
    .exec();
}

/**
 * A guarded, single-document update of one stock unit.
 *
 * Every quantity rule the app has lives in this one filter, so nothing can take
 * stock it should not:
 *
 *   availableAtLeast — on hand MINUS reserved must cover the amount. This is
 *     what stops an online checkout from selling units already committed to a
 *     sales order, and it is why a plain `stockQty >= n` filter is not enough.
 *   reservedAtLeast  — there is a reservation big enough to release or deliver.
 *   stockEquals      — the optimistic guard behind "set stock to N".
 *
 * The variant path cannot use `$elemMatch`, because `$elemMatch` may not contain
 * `$expr` and the availability rule is a comparison BETWEEN two fields of the
 * same array element. Instead the element is matched with a document-level
 * `$expr` over `$map`, and the write still targets exactly that element through
 * `arrayFilters`. It remains one atomic update of one document.
 */
type UnitGuard = {
  availableAtLeast?: number;
  reservedAtLeast?: number;
  stockEquals?: number;
};

async function updateUnit(
  productId: string,
  variantId: string | null,
  inc: { stock?: number; reserved?: number },
  guard: UnitGuard,
): Promise<boolean> {
  const $inc: Record<string, number> = {};
  if (inc.stock) $inc.stockQty = inc.stock;
  if (inc.reserved) $inc.reservedQty = inc.reserved;
  if (Object.keys($inc).length === 0) return true;

  if (!variantId) {
    const conditions: Record<string, unknown>[] = [];
    if (guard.availableAtLeast !== undefined) {
      conditions.push({
        $gte: [
          {
            $subtract: [
              { $ifNull: ["$stockQty", 0] },
              { $ifNull: ["$reservedQty", 0] },
            ],
          },
          guard.availableAtLeast,
        ],
      });
    }
    if (guard.reservedAtLeast !== undefined) {
      conditions.push({
        $gte: [{ $ifNull: ["$reservedQty", 0] }, guard.reservedAtLeast],
      });
    }
    const filter: Record<string, unknown> = { _id: productId };
    if (guard.stockEquals !== undefined) filter.stockQty = guard.stockEquals;
    if (conditions.length > 0) filter.$expr = { $and: conditions };

    const res = await Product.updateOne(filter, { $inc }).exec();
    return res.modifiedCount > 0;
  }

  const elementConditions: Record<string, unknown>[] = [
    { $eq: ["$$v.id", variantId] },
  ];
  if (guard.availableAtLeast !== undefined) {
    elementConditions.push({
      $gte: [
        {
          $subtract: [
            { $ifNull: ["$$v.stockQty", 0] },
            { $ifNull: ["$$v.reservedQty", 0] },
          ],
        },
        guard.availableAtLeast,
      ],
    });
  }
  if (guard.reservedAtLeast !== undefined) {
    elementConditions.push({
      $gte: [{ $ifNull: ["$$v.reservedQty", 0] }, guard.reservedAtLeast],
    });
  }
  if (guard.stockEquals !== undefined) {
    elementConditions.push({ $eq: ["$$v.stockQty", guard.stockEquals] });
  }

  const variantInc: Record<string, number> = {};
  if (inc.stock) variantInc["variants.$[v].stockQty"] = inc.stock;
  if (inc.reserved) variantInc["variants.$[v].reservedQty"] = inc.reserved;

  const res = await Product.updateOne(
    {
      _id: productId,
      $expr: {
        $anyElementTrue: {
          $map: {
            input: { $ifNull: ["$variants", []] },
            as: "v",
            in: { $and: elementConditions },
          },
        },
      },
    },
    { $inc: variantInc },
    { arrayFilters: [{ "v.id": variantId }] },
  ).exec();
  return res.modifiedCount > 0;
}

/** What each movement type is allowed to do, and what must be true first. */
function guardFor(input: MovementInput): UnitGuard {
  const guard: UnitGuard = {};
  if (input.expectedStock !== undefined)
    guard.stockEquals = input.expectedStock;

  // Taking stock off the shelf — a sale, a write-off, a "set to N" downwards.
  // Guarded on AVAILABLE, so committed stock is untouchable.
  if (input.qtyDelta < 0 && input.type !== "deliver") {
    guard.availableAtLeast = -input.qtyDelta;
  }
  // Releasing or delivering requires the reservation to actually exist.
  if (input.reservedDelta && input.reservedDelta < 0) {
    guard.reservedAtLeast = -input.reservedDelta;
  }
  // Reserving requires enough uncommitted stock.
  if (input.reservedDelta && input.reservedDelta > 0) {
    guard.availableAtLeast = input.reservedDelta;
  }
  return guard;
}

/**
 * Apply a stock change and record an audit `InventoryMovement`.
 *
 * The update is atomic and single-document (see `updateUnit`), so there is no
 * overselling without a multi-document transaction — which matters because the
 * app runs on standalone Mongo.
 *
 * After the write the unit's new balances are stamped on the movement
 * (`stockAfter`, `reservedAfter`) and, when the change crosses the product's
 * low-stock threshold or hits zero, the admins are notified (best-effort — an
 * alert failure never fails the movement).
 */
export async function applyMovement(
  input: MovementInput,
): Promise<MovementResult> {
  await connectToDatabase();
  // A movement that changes neither stock nor reservations is a no-op. Note
  // that a reservation legitimately has qtyDelta 0 — the units do not move —
  // so the reserved side has to be checked here too.
  if (input.qtyDelta === 0 && !input.reservedDelta) {
    return { stockAfter: null };
  }

  const variantId = input.variantId ?? null;
  const expected = input.expectedStock;
  const reservedDelta = input.reservedDelta ?? 0;
  if (expected !== undefined && expected + input.qtyDelta < 0) {
    throw new InsufficientStockError(input.productId);
  }

  const applied = await updateUnit(
    input.productId,
    variantId,
    { stock: input.qtyDelta, reserved: reservedDelta },
    guardFor(input),
  );
  if (!applied) {
    if (expected !== undefined) throw new StockChangedError(input.productId);
    throw new InsufficientStockError(input.productId);
  }

  // Balance after the change — for the ledger and the threshold alerts.
  let product: Lean<ProductLite> | null = null;
  let stockAfter: number | null = null;
  let reservedAfter: number | null = null;
  try {
    product = await loadProductLite(input.productId);
    if (product) {
      stockAfter = unitStock(product, variantId);
      reservedAfter = unitReserved(product, variantId);
    }
  } catch (e) {
    logger.warn("inventory: could not read stock after movement", e);
  }

  await InventoryMovement.create({
    productId: input.productId,
    variantId,
    type: input.type,
    qtyDelta: input.qtyDelta,
    reason: input.reason,
    source: input.source ?? null,
    reservedDelta,
    reservedAfter,
    stockAfter,
    refOrderId: input.refOrderId ?? null,
    refSalesOrderId: input.refSalesOrderId ?? null,
    createdBy: input.createdBy ?? null,
  });

  if (product && stockAfter != null) {
    await alertOnThreshold(
      product,
      input.productId,
      variantId,
      stockAfter - (reservedAfter ?? 0),
      // Availability moved by the stock change minus the reservation change.
      input.qtyDelta - reservedDelta,
    );
  }
  return { stockAfter, reservedAfter };
}

// ───────────────────────── sales-order reservations ─────────────────────────

type ReservationInput = {
  productId: string;
  variantId?: string | null;
  qty: number;
  refSalesOrderId: string;
  createdBy?: string;
  reason?: string;
};

/**
 * Commit stock to an invoiced sales order. The units stay on the shelf — they
 * are simply no longer available to anyone else. Throws `InsufficientStockError`
 * when the AVAILABLE quantity cannot cover it.
 */
export async function reserveStock(
  input: ReservationInput,
): Promise<MovementResult> {
  return applyMovement({
    productId: input.productId,
    variantId: input.variantId ?? null,
    type: "reserve",
    qtyDelta: 0,
    reservedDelta: input.qty,
    reason: input.reason ?? "sales order",
    source: "sales_order",
    refSalesOrderId: input.refSalesOrderId,
    createdBy: input.createdBy,
  });
}

/** Give a reservation back (the order was cancelled, reverted or amended down). */
export async function releaseStock(
  input: ReservationInput,
): Promise<MovementResult> {
  return applyMovement({
    productId: input.productId,
    variantId: input.variantId ?? null,
    type: "release",
    qtyDelta: 0,
    reservedDelta: -input.qty,
    reason: input.reason ?? "sales order released",
    source: "sales_order",
    refSalesOrderId: input.refSalesOrderId,
    createdBy: input.createdBy,
  });
}

/** Hand the goods over: the reserved units leave stock for good. */
export async function deliverReserved(
  input: ReservationInput,
): Promise<MovementResult> {
  return applyMovement({
    productId: input.productId,
    variantId: input.variantId ?? null,
    type: "deliver",
    qtyDelta: -input.qty,
    reservedDelta: -input.qty,
    reason: input.reason ?? "sales order delivered",
    source: "sales_order",
    refSalesOrderId: input.refSalesOrderId,
    createdBy: input.createdBy,
  });
}

/**
 * Bell notification when a movement takes a tracked, active unit across its
 * low-stock threshold, or down to zero. Firing on the CROSSING (not on every
 * movement below the line) keeps the feed to one alert per event.
 */
async function alertOnThreshold(
  product: Lean<ProductLite>,
  productId: string,
  variantId: string | null,
  after: number,
  qtyDelta: number,
): Promise<void> {
  try {
    if (product.status !== "active" || !isStockTracked(product)) return;
    const before = after - qtyDelta;
    const threshold = Number(product.lowStockThreshold ?? 0);
    const variant = variantId
      ? product.variants?.find((v) => v.id === variantId)
      : undefined;
    const name =
      localize(product.name, "en") +
      (variant ? ` · ${variantLabel(variant.options)}` : "");
    const sku = variant?.sku ?? product.sku;
    const href = `/admin/inventory?q=${encodeURIComponent(sku)}`;
    const entity = { kind: "product", id: productId, ref: sku };

    if (after <= 0 && before > 0) {
      await notifyAdmins({
        type: "inventory.out_of_stock",
        severity: "warning",
        title: `Out of stock: ${name}`,
        body: `SKU ${sku} · was ${before}, now ${after}`,
        href,
        entity,
      });
    } else if (after <= threshold && before > threshold) {
      await notifyAdmins({
        type: "inventory.low_stock",
        severity: "warning",
        title: `Low stock: ${name}`,
        body: `${after} left (low at ${threshold}) · SKU ${sku}`,
        href,
        entity,
      });
    }
  } catch (e) {
    logger.warn("inventory: low-stock alert failed", e);
  }
}

/** Admin manual adjustment (positive or negative). */
export async function adjustStock(input: {
  productId: string;
  /** Adjust one variant instead of the base stock. */
  variantId?: string | null;
  qtyDelta: number;
  type?: "adjustment" | "purchase" | "return";
  reason?: string;
  source?: string | null;
  createdBy?: string;
}): Promise<MovementResult> {
  return applyMovement({
    ...input,
    type: input.type ?? "adjustment",
    source: input.source ?? "manual",
  });
}

/**
 * "Set to N": reads the unit's balance, applies the difference with an
 * optimistic guard and retries when a sale or another admin moved the stock
 * in between — so the final balance is exactly N, never N ± a lost update.
 *
 * N is the ON-HAND figure (what a stock count finds on the shelf). Setting it
 * below what is already committed to a sales order is refused, because those
 * units are promised to someone.
 */
export async function setStock(input: {
  productId: string;
  variantId?: string | null;
  targetQty: number;
  reason?: string;
  source?: string | null;
  createdBy?: string;
}): Promise<MovementResult & { changed: boolean }> {
  await connectToDatabase();
  const variantId = input.variantId ?? null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const product = await loadProductLite(input.productId);
    const current = product ? unitStock(product, variantId) : null;
    if (current == null) throw new UnitNotFoundError(input.productId);

    // Counting fewer units than are already promised to a sales order is a
    // refusal, not a lost update — say so plainly rather than letting the
    // optimistic guard fail four times and report a phantom race.
    const reserved = unitReserved(product!, variantId) ?? 0;
    if (input.targetQty < reserved) {
      throw new InsufficientStockError(input.productId);
    }

    const delta = input.targetQty - current;
    if (delta === 0) return { changed: false, stockAfter: current };
    try {
      const res = await applyMovement({
        productId: input.productId,
        variantId,
        type: "adjustment",
        qtyDelta: delta,
        reason: input.reason,
        source: input.source ?? "set",
        createdBy: input.createdBy,
        expectedStock: current,
      });
      return { changed: true, stockAfter: res.stockAfter };
    } catch (e) {
      if (!(e instanceof StockChangedError)) throw e;
    }
  }
  throw new StockChangedError(input.productId);
}

export async function getMovementHistory(productId: string) {
  return listMovementsByProduct(productId);
}

/** Force stock tracking on/off for a product; null restores the default rule. */
export async function setTrackStock(
  productId: string,
  trackStock: boolean | null,
): Promise<boolean> {
  await connectToDatabase();
  const res = await Product.updateOne(
    { _id: productId, deletedAt: null },
    { $set: { trackStock } },
  ).exec();
  return res.matchedCount > 0;
}

// ───────────── Admin entry points (seller-override policy + notifications) ─────────────

type OverrideContext = {
  product: Lean<ProductLite>;
  variantId: string | null;
  before: number;
};

/**
 * Seller listings are stock-managed in the seller portal, so an admin change
 * must be an explicit override — and the seller is told about it. Returns the
 * context needed for the notification when the unit belongs to a seller.
 */
async function checkAdminMayAdjust(
  productId: string,
  variantId: string | null,
  override: boolean | undefined,
): Promise<OverrideContext | null> {
  const product = await loadProductLite(productId);
  const before = product ? unitStock(product, variantId) : null;
  if (!product || before == null) throw new UnitNotFoundError(productId);
  if (!product.sellerId) return null;
  if (!override) throw new SellerManagedError(productId);
  return { product, variantId, before };
}

async function notifyOverride(
  ctx: OverrideContext,
  after: number | null,
  reason: string | undefined,
): Promise<void> {
  try {
    const seller = await getSellerById(String(ctx.product.sellerId));
    if (!seller) return;
    const variant = ctx.variantId
      ? ctx.product.variants?.find((v) => v.id === ctx.variantId)
      : undefined;
    await notifySellerStockOverride(seller, {
      productName: localize(ctx.product.name, "en"),
      variantLabel: variant ? variantLabel(variant.options) : null,
      sku: variant?.sku ?? ctx.product.sku,
      before: ctx.before,
      after: after ?? ctx.before,
      reason,
    });
  } catch (e) {
    logger.warn("inventory: seller override notification failed", e);
  }
}

export async function adminAdjustStock(
  input: AdjustStockInput & { createdBy: string; source?: string },
): Promise<MovementResult & { overridden: boolean }> {
  await connectToDatabase();
  const variantId = input.variantId ?? null;
  const ctx = await checkAdminMayAdjust(
    input.productId,
    variantId,
    input.override,
  );
  const res = await applyMovement({
    productId: input.productId,
    variantId,
    type: input.type,
    qtyDelta: input.qtyDelta,
    reason: input.reason,
    source: ctx ? "override" : (input.source ?? "manual"),
    createdBy: input.createdBy,
  });
  if (ctx) await notifyOverride(ctx, res.stockAfter, input.reason);
  return { ...res, overridden: Boolean(ctx) };
}

export async function adminSetStock(
  input: SetStockInput & { createdBy: string },
): Promise<MovementResult & { changed: boolean; overridden: boolean }> {
  await connectToDatabase();
  const variantId = input.variantId ?? null;
  const ctx = await checkAdminMayAdjust(
    input.productId,
    variantId,
    input.override,
  );
  const res = await setStock({
    productId: input.productId,
    variantId,
    targetQty: input.targetQty,
    reason: input.reason,
    source: ctx ? "override" : "set",
    createdBy: input.createdBy,
  });
  if (ctx && res.changed)
    await notifyOverride(ctx, res.stockAfter, input.reason);
  return { ...res, overridden: Boolean(ctx) };
}

export type BulkLineResult = {
  productId: string;
  variantId: string | null;
  qtyDelta: number;
  ok: boolean;
  stockAfter?: number | null;
  error?: "insufficient_stock" | "not_found" | "seller_managed" | "failed";
};

export type BulkAdjustResult = {
  applied: number;
  failed: number;
  lines: BulkLineResult[];
};

/**
 * Apply many deltas (bulk receive / CSV import). Lines are independent: a
 * failing line (e.g. a write-off larger than the balance) is reported and the
 * others still apply — the same no-transaction stance as the order saga.
 */
export async function adminBulkAdjust(
  input: BulkAdjustInput & { createdBy: string },
): Promise<BulkAdjustResult> {
  await connectToDatabase();
  const lines: BulkLineResult[] = [];
  for (const line of input.lines) {
    const variantId = line.variantId ?? null;
    const base = {
      productId: line.productId,
      variantId,
      qtyDelta: line.qtyDelta,
    };
    try {
      const ctx = await checkAdminMayAdjust(
        line.productId,
        variantId,
        input.override,
      );
      const res = await applyMovement({
        productId: line.productId,
        variantId,
        type: input.type,
        qtyDelta: line.qtyDelta,
        reason: line.reason ?? input.reason,
        source: ctx ? "override" : input.source,
        createdBy: input.createdBy,
      });
      if (ctx)
        await notifyOverride(ctx, res.stockAfter, line.reason ?? input.reason);
      lines.push({ ...base, ok: true, stockAfter: res.stockAfter });
    } catch (e) {
      const error =
        e instanceof InsufficientStockError
          ? "insufficient_stock"
          : e instanceof UnitNotFoundError
            ? "not_found"
            : e instanceof SellerManagedError
              ? "seller_managed"
              : "failed";
      if (error === "failed") logger.warn("inventory: bulk line failed", e);
      lines.push({ ...base, ok: false, error });
    }
  }
  const applied = lines.filter((l) => l.ok).length;
  return { applied, failed: lines.length - applied, lines };
}
