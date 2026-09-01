import mongoose, { Schema, type Model } from "mongoose";
import type { Storefront } from "@/lib/schemas/catalog";

export interface ICartItem {
  productId: mongoose.Types.ObjectId;
  /** null = the product itself (no variants); else a Product.variants[].id. */
  variantId?: string | null;
  qty: number;
  priceMinorSnapshot: number;
}

export interface ICart {
  userId?: mongoose.Types.ObjectId | null;
  guestId?: string | null;
  /**
   * Which storefront this cart belongs to. Absent = a legacy (pre-Medtrade)
   * cart, which is always a marketplace one — reads match it with
   * `$in: ["marketplace", null]` and `getOrCreateCart` back-fills it.
   */
  storefront?: Storefront | null;
  items: ICartItem[];
  createdAt: Date;
  updatedAt: Date;
}

const cartItemSchema = new Schema<ICartItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: String, default: null },
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
    // No `default` either: an absent value must stay absent so it keeps
    // reading as a legacy marketplace cart until it is normalized on write.
    storefront: { type: String, enum: ["instruments", "marketplace"] },
    items: { type: [cartItemSchema], default: [] },
  },
  { collection: "carts", timestamps: true },
);

// One cart per user / per guest PER STOREFRONT — a buyer can hold a Medtrade
// cart and a Spiber Kart cart at the same time. Partial indexes only cover docs
// where the owning field is actually present with the right type, so guest
// carts (no userId) and user carts (no guestId) never collide on a null value.
//
// ⚠ MIGRATION: the old single-field unique indexes (`userId_1`, `guestId_1`)
// must be dropped once per database, or they still forbid a second cart per
// owner. See scripts/migrate-cart-storefront.mjs.
cartSchema.index(
  { userId: 1, storefront: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: "objectId" } } },
);
cartSchema.index(
  { guestId: 1, storefront: 1 },
  { unique: true, partialFilterExpression: { guestId: { $type: "string" } } },
);

export const Cart: Model<ICart> =
  (mongoose.models.Cart as Model<ICart>) ??
  mongoose.model<ICart>("Cart", cartSchema);
