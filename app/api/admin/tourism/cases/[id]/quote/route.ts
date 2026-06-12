import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { medicalCaseQuoteSchema } from "@/lib/schemas/medical-case";
import { setCaseQuotation } from "@/lib/services/medical-case.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, medicalCaseQuoteSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const result = await setCaseQuotation(id, parsed.data, admin.sub);
  if (!result.ok) return fail({ code: result.code }, 404);
  await writeAudit({
    actorId: admin.sub,
    action: "medicalCase.quote",
    entityType: "MedicalCase",
    entityId: id,
    after: { amountMinor: parsed.data.amountMinor ?? null },
  });
  return ok({ id, status: result.case.status });
}
