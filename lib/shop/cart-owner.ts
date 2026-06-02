import { cookies } from "next/headers";
import { getSessionUser } from "@/lib/auth/current-user";
import type { CartOwner } from "@/lib/repositories/cart.repo";

const GUEST_COOKIE = "guest_id";

/**
 * Resolve the current cart owner: the logged-in user, or a guest identified by
 * an httpOnly cookie (created on first use). Call from route handlers (which
 * may set cookies) — not from Server Components.
 */
export async function resolveCartOwner(): Promise<CartOwner> {
  const user = await getSessionUser();
  if (user) return { userId: user.sub };

  const store = await cookies();
  let guestId = store.get(GUEST_COOKIE)?.value;
  if (!guestId) {
    guestId = crypto.randomUUID();
    store.set(GUEST_COOKIE, guestId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 180, // 180 days
    });
  }
  return { guestId };
}

/** Read-only owner resolution (no cookie mutation) for Server Components. */
export async function readCartOwner(): Promise<CartOwner | null> {
  const user = await getSessionUser();
  if (user) return { userId: user.sub };
  const guestId = (await cookies()).get(GUEST_COOKIE)?.value;
  return guestId ? { guestId } : null;
}
