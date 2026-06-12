import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { partnerApplicationCreateSchema } from "@/lib/schemas/partner-application";
import { createPartnerApplication } from "@/lib/services/partner-application.service";

export const dynamic = "force-dynamic";

/** Public "Partner With Us" application. Rate-limited + honeypot. */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`partner:${ip}`, 5, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const parsed = await parseJson(req, partnerApplicationCreateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  if (parsed.data.website) {
    return ok({ partnerApplicationNumber: "SPM-PTR-OK", status: "new" });
  }
  const created = await createPartnerApplication(parsed.data, {
    locale: parsed.data.locale,
  });
  return ok({
    partnerApplicationNumber: created.partnerApplicationNumber,
    status: created.status,
  });
}
