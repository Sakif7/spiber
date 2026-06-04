import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import {
  Product,
  type IProduct,
  type IProductVariant,
} from "@/lib/models/product";
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
  variantId: string | null;
  slug: string;
  name: string;
  variantLabel?: string;
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

/** Same cart line = same product AND same variant (null-normalized). */
function sameLine(
  item: { productId: unknown; variantId?: string | null },
  productId: string,
  variantId: string | null,
): boolean {
  return (
    String(item.productId) === productId &&
    (item.variantId ?? null) === variantId
  );
}

function findVariant(
  product: Pick<IProduct, "variants">,
  variantId: string | null,
): IProductVariant | undefined {
  if (!variantId) return undefined;
  return product.variants?.find((v) => v.id === variantId);
}

/** Resolved unit price for a (product, variant); null when none is set. */
function resolvePrice(
  product: Pick<IProduct, "priceMinor">,
  variant: IProductVariant | undefined,
): number | null {
  if (variant) return variant.priceMinorOverride ?? product.priceMinor;
  return product.priceMinor;
}

/** A short label for a variant, e.g. "M · Red". */
function variantLabel(
  variant: IProductVariant | undefined,
): string | undefined {
  if (!variant) return undefined;
  return variant.options.map((o) => o.value).join(" · ");
}

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
    const variantId = it.variantId ?? null;
    const variant = findVariant(p, variantId);
    if (variantId && !variant) continue; // variant gone — drop
    const price = resolvePrice(p, variant);
    if (price == null) continue; // not buyable — drop
    const stockQty = variant ? variant.stockQty : p.stockQty;
    const lineTotalMinor = price * it.qty;
    subtotalMinor += lineTotalMinor;
    count += it.qty;
    items.push({
      productId: String(p._id),
      variantId,
      slug: p.slug,
      name: localize(p.name, locale),
      variantLabel: variantLabel(variant),
      image: variant?.image ?? p.images[0],
      priceMinor: price,
      qty: it.qty,
      lineTotalMinor,
      stockQty,
      inStock: stockQty >= it.qty,
    });
  }
  return { items, subtotalMinor, count };
}

export async function addToCart(
  owner: CartOwner,
  productId: string,
  qty: number,
  variantId: string | null = null,
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

  const variant = findVariant(product, variantId);
  if (variantId && !variant) throw new Error("product_unavailable");
  const price = resolvePrice(product, variant);
  if (price == null) throw new Error("product_unavailable");

  const cart = await getOrCreateCart(owner);
  const existing = cart.items.find((i) => sameLine(i, productId, variantId));
  if (existing) {
    existing.qty = Math.min(999, existing.qty + qty);
  } else {
    cart.items.push({
      productId: new mongoose.Types.ObjectId(productId),
      variantId,
      qty,
      priceMinorSnapshot: price,
    });
  }
  await cart.save();
}

export async function updateCartItem(
  owner: CartOwner,
  productId: string,
  qty: number,
  variantId: string | null = null,
) {
  const cart = await findCart(owner);
  if (!cart) return;
  if (qty <= 0) {
    cart.items = cart.items.filter((i) => !sameLine(i, productId, variantId));
  } else {
    const item = cart.items.find((i) => sameLine(i, productId, variantId));
    if (item) item.qty = qty;
  }
  await cart.save();
}

export async function removeCartItem(
  owner: CartOwner,
  productId: string,
  variantId: string | null = null,
) {
  const cart = await findCart(owner);
  if (!cart) return;
  cart.items = cart.items.filter((i) => !sameLine(i, productId, variantId));
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
    const existing = userCart.items.find((i) =>
      sameLine(i, String(gi.productId), gi.variantId ?? null),
    );
    if (existing) existing.qty = Math.min(999, existing.qty + gi.qty);
    else userCart.items.push(gi);
  }
  await userCart.save();
  await deleteCart({ guestId });
}
