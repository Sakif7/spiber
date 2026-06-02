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
    // No `default: null` — a guest cart must OMIT userId entirely (and vice
    // versa). A sparse index still indexes explicit nulls, so multiple null
    // userIds would collide; absent fields are what we want.
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    guestId: { type: String },
    items: { type: [cartItemSchema], default: [] },
  },
  { collection: "carts", timestamps: true },
);

// One cart per user / per guest. Partial indexes only cover docs where the
// field is actually present with the right type, so guest carts (no userId)
// and user carts (no guestId) never collide on a null value.
cartSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: "objectId" } } },
);
cartSchema.index(
  { guestId: 1 },
  { unique: true, partialFilterExpression: { guestId: { $type: "string" } } },
);

export const Cart: Model<ICart> =
  (mongoose.models.Cart as Model<ICart>) ??
  mongoose.model<ICart>("Cart", cartSchema);
