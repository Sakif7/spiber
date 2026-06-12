import { z } from "zod";
import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { getMedicalCaseByNumber } from "@/lib/repositories/medicalCases.repo";

export const dynamic = "force-dynamic";

const lookupSchema = z.object({
  caseNumber: z.string().min(1).max(60),
  email: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().toLowerCase() : v),
    z.email(),
  ),
});

/**
 * Guest case-status lookup by reference + email (POST so the email never lands
 * in a URL/log). Returns status + arrangement checklist + quotation SUMMARY
 * only — NEVER document keys or other patients' data.
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`case-lookup:${ip}`, 10, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const parsed = await parseJson(req, lookupSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const c = await getMedicalCaseByNumber(
    parsed.data.caseNumber,
    parsed.data.email,
  );
  if (!c) return fail({ code: "not_found" }, 404);

  return ok({
    caseNumber: c.caseNumber,
    status: c.status,
    patientName: c.patient.name,
    requestedService: c.requestedService ?? null,
    checklist: c.arrangementChecklist,
    quotation: c.quotation
      ? {
          amountMinor: c.quotation.amountMinor ?? null,
          validUntil: c.quotation.validUntil ?? null,
          notes: c.quotation.notes ?? null,
        }
      : null,
    documentCount: c.documents?.length ?? 0,
    updatedAt: c.updatedAt,
  });
}
