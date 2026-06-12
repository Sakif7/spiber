import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { travelRequestCreateSchema } from "@/lib/schemas/travel-request";
import { createTravelRequest } from "@/lib/services/travel-request.service";

export const dynamic = "force-dynamic";

/** Public air/hotel/visa/transfer REQUEST (not a live booking). Rate-limited + honeypot. */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`travel:${ip}`, 5, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const parsed = await parseJson(req, travelRequestCreateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  if (parsed.data.website) {
    return ok({ travelRequestNumber: "SPM-TRV-OK", status: "new" });
  }
  const created = await createTravelRequest(parsed.data, {
    locale: parsed.data.locale,
  });
  return ok({
    travelRequestNumber: created.travelRequestNumber,
    status: created.status,
  });
}
