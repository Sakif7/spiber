import mongoose, { Schema, type Model } from "mongoose";
import { movementTypeEnum, type MovementType } from "@/lib/schemas/inventory";

export interface IInventoryMovement {
  productId: mongoose.Types.ObjectId;
  /** null = base product stock; else the Product.variants[].id affected. */
  variantId?: string | null;
  type: MovementType;
  qtyDelta: number;
  /** Free-text note from the admin, or a legacy machine reason ("order", "initial_stock", …). */
  reason?: string;
  /** Machine provenance for admin-made changes: manual | set | bulk | csv | override. */
  source?: string | null;
  /**
   * Change to the RESERVED quantity, alongside `qtyDelta` (which always means
   * the change to stock on hand). A reserve is `qtyDelta 0 / reservedDelta +n`,
   * a release the reverse, and a delivery moves both down together — so summing
   * `qtyDelta` over the ledger still reconstructs `stockQty` exactly as before.
   */
  reservedDelta?: number;
  reservedAfter?: number | null;
  /** The unit's on-hand stock right after this movement (null on legacy rows). */
  stockAfter?: number | null;
  refOrderId?: mongoose.Types.ObjectId | null;
  /** The sales order that reserved, released or took this stock. */
  refSalesOrderId?: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
}

const inventoryMovementSchema = new Schema<IInventoryMovement>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    variantId: { type: String, default: null },
    type: {
      type: String,
      // Derived from the Zod enum so the two cannot drift: a type added to the
      // schema but not here fails validation only at runtime.
      enum: movementTypeEnum.options,
      required: true,
    },
    qtyDelta: { type: Number, required: true },
    reason: { type: String },
    source: { type: String, default: null },
    reservedDelta: { type: Number, default: 0 },
    reservedAfter: { type: Number, default: null },
    stockAfter: { type: Number, default: null },
    refOrderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    refSalesOrderId: {
      type: Schema.Types.ObjectId,
      ref: "SalesOrder",
      default: null,
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    collection: "inventory_movements",
    timestamps: { createdAt: true, updatedAt: false },
  },
);

// Per-product (and optionally per-variant) movement history, newest first.
inventoryMovementSchema.index({ productId: 1, variantId: 1, createdAt: -1 });
// The admin ledger: newest first, optionally by type / order / admin.
inventoryMovementSchema.index({ createdAt: -1 });
inventoryMovementSchema.index({ type: 1, createdAt: -1 });
inventoryMovementSchema.index({ refOrderId: 1 });
inventoryMovementSchema.index({ createdBy: 1, createdAt: -1 });

export const InventoryMovement: Model<IInventoryMovement> =
  (mongoose.models.InventoryMovement as Model<IInventoryMovement>) ??
  mongoose.model<IInventoryMovement>(
    "InventoryMovement",
    inventoryMovementSchema,
  );
