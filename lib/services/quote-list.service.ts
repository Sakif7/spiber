import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Product, type IProduct } from "@/lib/models/product";
import type { Lean } from "@/lib/models/_shared";
import {
  findQuoteList,
  getOrCreateQuoteList,
  deleteQuoteList,
} from "@/lib/repositories/quote-list.repo";
import type { CartOwner } from "@/lib/repositories/cart.repo";
import { localize } from "@/lib/schemas/localized";
import type { Locale } from "@/i18n/routing";

/** A quote-list line — NO price (Instruments is quote-only). */
export type QuoteLineView = {
  productId: string;
  variantId: string | null;
  slug: string;
  sku: string;
  name: string;
  variantLabel?: string;
  image?: string;
  qty: number;
};

export type QuoteListView = { items: QuoteLineView[]; count: number };

const EMPTY: QuoteListView = { items: [], count: 0 };

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

export async function getQuoteListView(
  owner: CartOwner,
  locale: Locale,
): Promise<QuoteListView> {
  const list = await findQuoteList(owner);
  if (!list || list.items.length === 0) return EMPTY;

  await connectToDatabase();
  const ids = list.items.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: ids } })
    .lean<Lean<IProduct>[]>()
    .exec();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const items: QuoteLineView[] = [];
  let count = 0;
  for (const it of list.items) {
    const p = byId.get(String(it.productId));
    if (!p) continue;
    const variantId = it.variantId ?? null;
    const variant = variantId
      ? p.variants?.find((v) => v.id === variantId)
      : undefined;
    if (variantId && !variant) continue;
    count += it.qty;
    items.push({
      productId: String(p._id),
      variantId,
      slug: p.slug,
      sku: variant?.sku ?? p.sku,
      name: localize(p.name, locale),
      variantLabel: variant?.options.map((o) => o.value).join(" · "),
      image: variant?.image ?? p.images[0],
      qty: it.qty,
    });
  }
  return { items, count };
}

export async function addToQuoteList(
  owner: CartOwner,
  productId: string,
  qty: number,
  variantId: string | null = null,
) {
  await connectToDatabase();
  const product = await Product.findOne({
    _id: productId,
    storefront: "instruments",
    status: "active",
    deletedAt: null,
  })
    .lean<Lean<IProduct>>()
    .exec();
  if (!product) throw new Error("product_unavailable");
  if (variantId && !product.variants?.some((v) => v.id === variantId)) {
    throw new Error("product_unavailable");
  }

  const list = await getOrCreateQuoteList(owner);
  const existing = list.items.find((i) => sameLine(i, productId, variantId));
  if (existing) existing.qty = Math.min(99999, existing.qty + qty);
  else
    list.items.push({
      productId: new mongoose.Types.ObjectId(productId),
      variantId,
      qty,
    });
  await list.save();
}

export async function updateQuoteListItem(
  owner: CartOwner,
  productId: string,
  qty: number,
  variantId: string | null = null,
) {
  const list = await findQuoteList(owner);
  if (!list) return;
  if (qty <= 0) {
    list.items = list.items.filter((i) => !sameLine(i, productId, variantId));
  } else {
    const item = list.items.find((i) => sameLine(i, productId, variantId));
    if (item) item.qty = qty;
  }
  await list.save();
}

export async function removeQuoteListItem(
  owner: CartOwner,
  productId: string,
  variantId: string | null = null,
) {
  const list = await findQuoteList(owner);
  if (!list) return;
  list.items = list.items.filter((i) => !sameLine(i, productId, variantId));
  await list.save();
}

export async function clearQuoteList(owner: CartOwner) {
  await deleteQuoteList(owner);
}

/** Merge a guest quote list into the user's on login, then drop the guest one. */
export async function mergeGuestQuoteList(guestId: string, userId: string) {
  const guest = await findQuoteList({ guestId });
  if (!guest || guest.items.length === 0) {
    if (guest) await deleteQuoteList({ guestId });
    return;
  }
  const userList = await getOrCreateQuoteList({ userId });
  for (const gi of guest.items) {
    const existing = userList.items.find((i) =>
      sameLine(i, String(gi.productId), gi.variantId ?? null),
    );
    if (existing) existing.qty = Math.min(99999, existing.qty + gi.qty);
    else userList.items.push(gi);
  }
  await userList.save();
  await deleteQuoteList({ guestId });
}
