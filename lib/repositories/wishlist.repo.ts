import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { WishlistItem } from "@/lib/models/wishlist";
import { Product, type IProduct } from "@/lib/models/product";
import type { Lean } from "@/lib/models/_shared";

function toOid(id: string): mongoose.Types.ObjectId | null {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    return null;
  }
}

/** Toggle a product in the user's wishlist; returns the new saved state. */
export async function toggleWishlist(
  userId: string,
  productId: string,
): Promise<{ wishlisted: boolean }> {
  await connectToDatabase();
  const pid = toOid(productId);
  if (!pid) return { wishlisted: false };
  const existing = await WishlistItem.findOne({ userId, productId: pid })
    .select("_id")
    .lean()
    .exec();
  if (existing) {
    await WishlistItem.deleteOne({ _id: existing._id }).exec();
    return { wishlisted: false };
  }
  try {
    await WishlistItem.create({ userId, productId: pid });
  } catch {
    // race on the unique index — treat as already saved
  }
  return { wishlisted: true };
}

/** The product ids the user has saved (for marking cards/detail). */
export async function listWishlistProductIds(
  userId: string,
): Promise<string[]> {
  await connectToDatabase();
  const rows = await WishlistItem.find({ userId })
    .select("productId")
    .lean<{ productId: mongoose.Types.ObjectId }[]>()
    .exec();
  return rows.map((r) => String(r.productId));
}

/** Saved products (active only), most-recently-saved first — for the wishlist page. */
export async function listWishlistProducts(
  userId: string,
): Promise<Lean<IProduct>[]> {
  await connectToDatabase();
  const rows = await WishlistItem.find({ userId })
    .sort({ createdAt: -1 })
    .select("productId")
    .lean<{ productId: mongoose.Types.ObjectId }[]>()
    .exec();
  const ids = rows.map((r) => r.productId);
  if (!ids.length) return [];
  const products = await Product.find({
    _id: { $in: ids },
    status: "active",
    deletedAt: null,
  })
    .lean<Lean<IProduct>[]>()
    .exec();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  return ids
    .map((id) => byId.get(String(id)))
    .filter((p): p is Lean<IProduct> => Boolean(p));
}
