import { cookies } from "next/headers";
import { mergeGuestCart } from "@/lib/services/cart.service";
import { mergeGuestQuoteList } from "@/lib/services/quote-list.service";
import { logger } from "@/lib/log";

const GUEST_COOKIE = "guest_id";

/**
 * Adopt everything a guest collected into the account they just signed in to:
 * their carts (one per storefront) and their Medtrade quote list.
 *
 * Both merge helpers existed but had NO call site, so a shopper who filled a
 * cart and then logged in silently lost it. This is that call site — run it from
 * any route handler that establishes a session (login, register).
 *
 * Best-effort by design: a merge failure must never block a sign-in, so errors
 * are logged and swallowed (mirrors the team-email seams). The guest cookie is
 * cleared afterwards so the now-empty guest identity can't be resurrected.
 */
export async function mergeGuestSessionInto(userId: string): Promise<void> {
  const store = await cookies();
  const guestId = store.get(GUEST_COOKIE)?.value;
  if (!guestId) return;

  try {
    await mergeGuestCart(guestId, userId);
  } catch (err) {
    logger.warn("mergeGuestCart failed", err);
  }
  try {
    await mergeGuestQuoteList(guestId, userId);
  } catch (err) {
    logger.warn("mergeGuestQuoteList failed", err);
  }

  store.delete(GUEST_COOKIE);
}
