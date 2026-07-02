import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { productRequestCreateSchema } from "@/lib/schemas/product-request";
import { createProductRequest } from "@/lib/services/product-request.service";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

export const dynamic = "force-dynamic";

/** Public "Request a product" submission. No auth — rate-limited + honeypot. */
export async function POST(req: Request) {
  if (!rateLimit(`product-request:${clientIp(req)}`, 5, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const parsed = await parseJson(req, productRequestCreateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  // Honeypot: a filled `website` flags spam — silent fake-success.
  if (parsed.data.website) {
    return ok({ requestNumber: "SPM-PRQ-OK", status: "new" });
  }
  const request = await createProductRequest(parsed.data);
  return ok({ requestNumber: request.requestNumber, status: request.status });
}
