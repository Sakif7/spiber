import mongoose, { Schema, type Model } from "mongoose";

/**
 * Login-required product wishlist. One row per (user, product); toggled on/off.
 */
export interface IWishlistItem {
  userId: mongoose.Types.ObjectId | string;
  productId: mongoose.Types.ObjectId | string;
  createdAt: Date;
  updatedAt: Date;
}

const wishlistItemSchema = new Schema<IWishlistItem>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
  },
  { collection: "wishlist_items", timestamps: true },
);

// One entry per user+product.
wishlistItemSchema.index({ userId: 1, productId: 1 }, { unique: true });

export const WishlistItem: Model<IWishlistItem> =
  (mongoose.models.WishlistItem as Model<IWishlistItem>) ??
  mongoose.model<IWishlistItem>("WishlistItem", wishlistItemSchema);
