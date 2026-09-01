import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { getSessionUser } from "@/lib/auth/current-user";
import { creditApplicationCreateSchema } from "@/lib/schemas/credit";
import { createCreditApplication } from "@/lib/services/credit.service";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

export const dynamic = "force-dynamic";

/** Apply for a Medtrade credit facility. Requires a logged-in user. */
export async function POST(req: Request) {
  if (!rateLimit(`credit-apply:${clientIp(req)}`, 5, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const user = await getSessionUser();
  if (!user) return fail({ code: "unauthorized" }, 401);

  const parsed = await parseJson(req, creditApplicationCreateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const result = await createCreditApplication(user.sub, parsed.data);
  if (!result.ok) return fail({ code: result.code }, 409);
  return ok({
    applicationNumber: result.application.applicationNumber,
    status: result.application.status,
  });
}
