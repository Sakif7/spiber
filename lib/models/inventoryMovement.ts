import mongoose, { Schema, type Model } from "mongoose";
import type { MovementType } from "@/lib/schemas/inventory";

export interface IInventoryMovement {
  productId: mongoose.Types.ObjectId;
  /** null = base product stock; else the Product.variants[].id affected. */
  variantId?: string | null;
  type: MovementType;
  qtyDelta: number;
  reason?: string;
  refOrderId?: mongoose.Types.ObjectId | null;
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
      enum: ["purchase", "sale", "adjustment", "return"],
      required: true,
    },
    qtyDelta: { type: Number, required: true },
    reason: { type: String },
    refOrderId: { type: Schema.Types.ObjectId, ref: "Order", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    collection: "inventory_movements",
    timestamps: { createdAt: true, updatedAt: false },
  },
);

// Per-product (and optionally per-variant) movement history, newest first.
inventoryMovementSchema.index({ productId: 1, variantId: 1, createdAt: -1 });

export const InventoryMovement: Model<IInventoryMovement> =
  (mongoose.models.InventoryMovement as Model<IInventoryMovement>) ??
  mongoose.model<IInventoryMovement>(
    "InventoryMovement",
    inventoryMovementSchema,
  );
