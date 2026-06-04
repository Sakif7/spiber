import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { reviewCreateSchema } from "@/lib/schemas/review";
import { submitReview } from "@/lib/services/review.service";
import { getSessionUser } from "@/lib/auth/current-user";
import { findUserById } from "@/lib/repositories/users.repo";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

export const dynamic = "force-dynamic";

/** Submit a marketplace product review (sign-in required; admin-moderated). */
export async function POST(req: Request) {
  if (!rateLimit(`review:${clientIp(req)}`, 6, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const user = await getSessionUser();
  if (!user) return fail({ code: "unauthorized" }, 401);

  const parsed = await parseJson(req, reviewCreateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const account = await findUserById(user.sub).catch(() => null);
  const authorName = account?.name?.trim() || "Customer";

  const result = await submitReview(user.sub, authorName, parsed.data);
  if (!result.ok) {
    return fail(
      { code: result.code },
      result.code === "already_reviewed" ? 409 : 400,
    );
  }
  return ok({ status: "pending" });
}
