import { connectToDatabase } from "@/lib/db/connect";
import { Product } from "@/lib/models/product";
import { InventoryMovement } from "@/lib/models/inventoryMovement";
import { listMovementsByProduct } from "@/lib/repositories/inventory.repo";
import type { MovementType } from "@/lib/schemas/inventory";

export class InsufficientStockError extends Error {
  constructor(public productId: string) {
    super(`Insufficient stock for product ${productId}`);
    this.name = "InsufficientStockError";
  }
}

export type MovementInput = {
  productId: string;
  type: MovementType;
  qtyDelta: number; // negative = decrement (e.g. sale)
  reason?: string;
  refOrderId?: string;
  createdBy?: string;
};

/**
 * Apply a stock change and record an audit `InventoryMovement`.
 * Decrements use a conditional `$inc` (atomic, single-document) that only
 * succeeds when enough stock exists — guaranteeing no overselling without
 * requiring a multi-document transaction (works on standalone Mongo).
 */
export async function applyMovement(input: MovementInput): Promise<void> {
  await connectToDatabase();
  if (input.qtyDelta === 0) return;

  if (input.qtyDelta < 0) {
    const need = -input.qtyDelta;
    const res = await Product.updateOne(
      { _id: input.productId, stockQty: { $gte: need } },
      { $inc: { stockQty: input.qtyDelta } },
    ).exec();
    if (res.modifiedCount === 0) {
      throw new InsufficientStockError(input.productId);
    }
  } else {
    await Product.updateOne(
      { _id: input.productId },
      { $inc: { stockQty: input.qtyDelta } },
    ).exec();
  }

  await InventoryMovement.create({
    productId: input.productId,
    type: input.type,
    qtyDelta: input.qtyDelta,
    reason: input.reason,
    refOrderId: input.refOrderId ?? null,
    createdBy: input.createdBy ?? null,
  });
}

/** Admin manual adjustment (positive or negative). */
export async function adjustStock(input: {
  productId: string;
  qtyDelta: number;
  reason?: string;
  createdBy?: string;
}): Promise<void> {
  await applyMovement({ ...input, type: "adjustment" });
}

export async function getMovementHistory(productId: string) {
  return listMovementsByProduct(productId);
}
