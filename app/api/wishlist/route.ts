import { z } from "zod";
import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { getSessionUser } from "@/lib/auth/current-user";
import { toggleWishlist } from "@/lib/repositories/wishlist.repo";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ productId: z.string().min(1) });

/** Toggle a product in the signed-in user's wishlist. */
export async function POST(req: Request) {
  if (!rateLimit(`wishlist:${clientIp(req)}`, 40, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const user = await getSessionUser();
  if (!user) return fail({ code: "unauthorized" }, 401);

  const parsed = await parseJson(req, bodySchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const result = await toggleWishlist(user.sub, parsed.data.productId);
  return ok(result);
}
