import type mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { Cart, type ICart } from "@/lib/models/cart";
import type { Storefront } from "@/lib/schemas/catalog";

export type CartOwner = { userId?: string; guestId?: string };

/**
 * Carts are scoped per storefront, so a buyer can hold a Medtrade cart and a
 * Spiber Kart cart at once.
 *
 * LEGACY: carts created before the split have no `storefront` field. They are
 * marketplace carts by definition, so marketplace reads match
 * `{ $in: ["marketplace", null] }` — in Mongo a `null` in `$in` also matches
 * documents where the field is absent. `getOrCreateCart` then back-fills the
 * field, so each legacy cart converges on first write.
 */
// Mongoose 9 dropped the exported `FilterQuery`; `QueryFilter` is the
// equivalent. The marketplace branch needs `null` inside `$in` (to match
// legacy docs where the field is ABSENT), which the non-nullable field type
// disallows — hence the single documented cast.
type CartFilter = mongoose.QueryFilter<ICart>;

function ownerFilter(owner: CartOwner, storefront: Storefront): CartFilter {
  const ownerPart = owner.userId
    ? { userId: owner.userId }
    : { guestId: owner.guestId };
  return storefront === "marketplace"
    ? ({
        ...ownerPart,
        storefront: { $in: ["marketplace", null] },
      } as unknown as CartFilter)
    : ({ ...ownerPart, storefront } as CartFilter);
}

/** Hydrated cart doc (mutable) for the owner + storefront, or null. */
export async function findCart(
  owner: CartOwner,
  storefront: Storefront = "marketplace",
) {
  await connectToDatabase();
  return Cart.findOne(ownerFilter(owner, storefront)).exec();
}

export async function getOrCreateCart(
  owner: CartOwner,
  storefront: Storefront = "marketplace",
) {
  await connectToDatabase();
  const existing = await Cart.findOne(ownerFilter(owner, storefront)).exec();
  if (existing) {
    // Normalize a legacy cart on first write so it stops relying on the
    // null-matching read path (and can never collide with a new one).
    if (existing.storefront == null) {
      existing.storefront = storefront;
      await existing.save();
    }
    return existing;
  }
  // Set only the owning field — never write a null for the other, or it lands
  // in the partial/unique index and collides with other null-owner carts.
  const doc = owner.userId
    ? { userId: owner.userId, storefront, items: [] }
    : { guestId: owner.guestId, storefront, items: [] };
  try {
    return await Cart.create(doc);
  } catch (err) {
    // Concurrent create for the same owner+storefront: the unique index picked
    // a winner, so read it back instead of failing the request.
    if ((err as { code?: number })?.code === 11000) {
      const winner = await Cart.findOne(ownerFilter(owner, storefront)).exec();
      if (winner) return winner;
    }
    throw err;
  }
}

export async function deleteCart(
  owner: CartOwner,
  storefront: Storefront = "marketplace",
) {
  await connectToDatabase();
  await Cart.deleteOne(ownerFilter(owner, storefront)).exec();
}

export type { ICart };
