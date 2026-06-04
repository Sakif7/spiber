import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { quotationCreateSchema } from "@/lib/schemas/quotation";
import { createQuotation } from "@/lib/services/quotation.service";
import { resolveCartOwner } from "@/lib/shop/cart-owner";
import { clearQuoteList } from "@/lib/services/quote-list.service";
import { getSessionUser } from "@/lib/auth/current-user";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

export const dynamic = "force-dynamic";

/** Public quotation submission (guest or signed-in). */
export async function POST(req: Request) {
  if (!rateLimit(`quotation:${clientIp(req)}`, 8, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const parsed = await parseJson(req, quotationCreateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const user = await getSessionUser();
  const result = await createQuotation(parsed.data, user?.sub);
  if (!result.ok) return fail({ code: result.code }, 400);

  // Clear the submitter's quote list so it doesn't linger.
  const owner = await resolveCartOwner();
  await clearQuoteList(owner).catch(() => {});

  return ok({
    quotationNumber: result.quotation.quotationNumber,
    status: result.quotation.status,
  });
}
