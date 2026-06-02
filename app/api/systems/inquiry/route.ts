import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { inquiryCreateSchema } from "@/lib/schemas/inquiry";
import { createInquiry } from "@/lib/services/inquiry.service";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

export const dynamic = "force-dynamic";

/** Public lead capture (custom-solution + quote/request-access). No auth. */
export async function POST(req: Request) {
  if (!rateLimit(`inquiry:${clientIp(req)}`, 8, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const parsed = await parseJson(req, inquiryCreateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const inquiry = await createInquiry(parsed.data);
  return ok({ inquiryNumber: inquiry.inquiryNumber, status: inquiry.status });
}
