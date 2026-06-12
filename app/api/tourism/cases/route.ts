import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { getSessionUser } from "@/lib/auth/current-user";
import { medicalCaseCreateSchema } from "@/lib/schemas/medical-case";
import { createMedicalCase } from "@/lib/services/medical-case.service";

export const dynamic = "force-dynamic";

/** Public medical-case submission (submit-with-reports). Rate-limited + honeypot. */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`case:${ip}`, 5, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }

  const parsed = await parseJson(req, medicalCaseCreateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  if (parsed.data.website) {
    return ok({ caseNumber: "SPM-CASE-OK", status: "new" });
  }

  const user = await getSessionUser();
  const created = await createMedicalCase(parsed.data, {
    userId: user?.sub,
    locale: parsed.data.locale,
  });
  return ok({ caseNumber: created.caseNumber, status: created.status });
}
