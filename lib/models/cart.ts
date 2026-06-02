import mongoose, { Schema, type Model } from "mongoose";

export interface ICartItem {
  productId: mongoose.Types.ObjectId;
  qty: number;
  priceMinorSnapshot: number;
}

export interface ICart {
  userId?: mongoose.Types.ObjectId | null;
  guestId?: string | null;
  items: ICartItem[];
  createdAt: Date;
  updatedAt: Date;
}

const cartItemSchema = new Schema<ICartItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    qty: { type: Number, required: true, min: 1 },
    priceMinorSnapshot: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const cartSchema = new Schema<ICart>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    guestId: { type: String, default: null },
    items: { type: [cartItemSchema], default: [] },
  },
  { collection: "carts", timestamps: true },
);

// One cart per user / per guest (sparse so nulls don't collide).
cartSchema.index({ userId: 1 }, { unique: true, sparse: true });
cartSchema.index({ guestId: 1 }, { unique: true, sparse: true });

export const Cart: Model<ICart> =
  (mongoose.models.Cart as Model<ICart>) ??
  mongoose.model<ICart>("Cart", cartSchema);
