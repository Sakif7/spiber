import { connectToDatabase } from "@/lib/db/connect";
import { Cart, type ICart } from "@/lib/models/cart";

export type CartOwner = { userId?: string; guestId?: string };

function ownerFilter(owner: CartOwner) {
  if (owner.userId) return { userId: owner.userId };
  return { guestId: owner.guestId };
}

/** Hydrated cart doc (mutable) for the owner, or null. */
export async function findCart(owner: CartOwner) {
  await connectToDatabase();
  return Cart.findOne(ownerFilter(owner)).exec();
}

export async function getOrCreateCart(owner: CartOwner) {
  await connectToDatabase();
  const existing = await Cart.findOne(ownerFilter(owner)).exec();
  if (existing) return existing;
  return Cart.create({
    userId: owner.userId ?? null,
    guestId: owner.guestId ?? null,
    items: [],
  });
}

export async function deleteCart(owner: CartOwner) {
  await connectToDatabase();
  await Cart.deleteOne(ownerFilter(owner)).exec();
}

export type { ICart };
