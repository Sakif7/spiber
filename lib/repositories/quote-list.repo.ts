import { connectToDatabase } from "@/lib/db/connect";
import { QuoteList } from "@/lib/models/quoteList";
import type { CartOwner } from "@/lib/repositories/cart.repo";

function ownerFilter(owner: CartOwner) {
  if (owner.userId) return { userId: owner.userId };
  return { guestId: owner.guestId };
}

/** Hydrated quote-list doc (mutable) for the owner, or null. */
export async function findQuoteList(owner: CartOwner) {
  await connectToDatabase();
  return QuoteList.findOne(ownerFilter(owner)).exec();
}

export async function getOrCreateQuoteList(owner: CartOwner) {
  await connectToDatabase();
  const existing = await QuoteList.findOne(ownerFilter(owner)).exec();
  if (existing) return existing;
  // Only write the owning field — never a null for the other (partial index).
  const doc = owner.userId
    ? { userId: owner.userId, items: [] }
    : { guestId: owner.guestId, items: [] };
  return QuoteList.create(doc);
}

export async function deleteQuoteList(owner: CartOwner) {
  await connectToDatabase();
  await QuoteList.deleteOne(ownerFilter(owner)).exec();
}
