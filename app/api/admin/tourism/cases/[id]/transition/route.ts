import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { medicalCaseTransitionSchema } from "@/lib/schemas/medical-case";
import { transitionMedicalCase } from "@/lib/services/medical-case.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, medicalCaseTransitionSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const result = await transitionMedicalCase(id, parsed.data.to, {
    note: parsed.data.note,
    actorId: admin.sub,
  });
  if (!result.ok) {
    return fail({ code: result.code }, result.code === "not_found" ? 404 : 409);
  }
  await writeAudit({
    actorId: admin.sub,
    action: `medicalCase.${parsed.data.to}`,
    entityType: "MedicalCase",
    entityId: id,
    after: { to: parsed.data.to },
  });
  return ok({ status: parsed.data.to });
}
