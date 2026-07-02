import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { getSessionUser } from "@/lib/auth/current-user";
import { sellerApplicationCreateSchema } from "@/lib/schemas/seller-application";
import { createSellerApplication } from "@/lib/services/seller-application.service";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

export const dynamic = "force-dynamic";

/** Submit a "Become a seller" application. Requires a logged-in user. */
export async function POST(req: Request) {
  if (!rateLimit(`seller-apply:${clientIp(req)}`, 5, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const user = await getSessionUser();
  if (!user) return fail({ code: "unauthorized" }, 401);

  const parsed = await parseJson(req, sellerApplicationCreateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const result = await createSellerApplication(user.sub, parsed.data);
  if (!result.ok) return fail({ code: result.code }, 409);
  return ok({
    applicationNumber: result.application.applicationNumber,
    status: result.application.status,
  });
}
