import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Product, type IProduct } from "@/lib/models/product";
import type { Lean } from "@/lib/models/_shared";
import {
  findCart,
  getOrCreateCart,
  deleteCart,
  type CartOwner,
} from "@/lib/repositories/cart.repo";
import { localize } from "@/lib/schemas/localized";
import type { Locale } from "@/i18n/routing";

export type CartLineView = {
  productId: string;
  slug: string;
  name: string;
  image?: string;
  priceMinor: number;
  qty: number;
  lineTotalMinor: number;
  stockQty: number;
  inStock: boolean;
};

export type CartView = {
  items: CartLineView[];
  subtotalMinor: number;
  count: number;
};

const EMPTY: CartView = { items: [], subtotalMinor: 0, count: 0 };

export async function getCartView(
  owner: CartOwner,
  locale: Locale,
): Promise<CartView> {
  const cart = await findCart(owner);
  if (!cart || cart.items.length === 0) return EMPTY;

  await connectToDatabase();
  const ids = cart.items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: ids } })
    .lean<Lean<IProduct>[]>()
    .exec();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const items: CartLineView[] = [];
  let subtotalMinor = 0;
  let count = 0;
  for (const it of cart.items) {
    const p = byId.get(String(it.productId));
    if (!p) continue; // product gone — silently drop from view
    const lineTotalMinor = p.priceMinor * it.qty;
    subtotalMinor += lineTotalMinor;
    count += it.qty;
    items.push({
      productId: String(p._id),
      slug: p.slug,
      name: localize(p.name, locale),
      image: p.images[0],
      priceMinor: p.priceMinor,
      qty: it.qty,
      lineTotalMinor,
      stockQty: p.stockQty,
      inStock: p.stockQty >= it.qty,
    });
  }
  return { items, subtotalMinor, count };
}

export async function addToCart(
  owner: CartOwner,
  productId: string,
  qty: number,
) {
  await connectToDatabase();
  const product = await Product.findOne({
    _id: productId,
    status: "active",
    deletedAt: null,
  })
    .lean<Lean<IProduct>>()
    .exec();
  if (!product) throw new Error("product_unavailable");

  const cart = await getOrCreateCart(owner);
  const existing = cart.items.find((i) => String(i.productId) === productId);
  if (existing) {
    existing.qty = Math.min(999, existing.qty + qty);
  } else {
    cart.items.push({
      productId: new mongoose.Types.ObjectId(productId),
      qty,
      priceMinorSnapshot: product.priceMinor,
    });
  }
  await cart.save();
}

export async function updateCartItem(
  owner: CartOwner,
  productId: string,
  qty: number,
) {
  const cart = await findCart(owner);
  if (!cart) return;
  if (qty <= 0) {
    cart.items = cart.items.filter((i) => String(i.productId) !== productId);
  } else {
    const item = cart.items.find((i) => String(i.productId) === productId);
    if (item) item.qty = qty;
  }
  await cart.save();
}

export async function removeCartItem(owner: CartOwner, productId: string) {
  const cart = await findCart(owner);
  if (!cart) return;
  cart.items = cart.items.filter((i) => String(i.productId) !== productId);
  await cart.save();
}

/** Merge a guest cart into the user's cart on login, then drop the guest cart. */
export async function mergeGuestCart(guestId: string, userId: string) {
  const guest = await findCart({ guestId });
  if (!guest || guest.items.length === 0) {
    if (guest) await deleteCart({ guestId });
    return;
  }
  const userCart = await getOrCreateCart({ userId });
  for (const gi of guest.items) {
    const existing = userCart.items.find(
      (i) => String(i.productId) === String(gi.productId),
    );
    if (existing) existing.qty = Math.min(999, existing.qty + gi.qty);
    else userCart.items.push(gi);
  }
  await userCart.save();
  await deleteCart({ guestId });
}
