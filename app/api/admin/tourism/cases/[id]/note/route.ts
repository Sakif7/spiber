import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { medicalCaseNoteSchema } from "@/lib/schemas/medical-case";
import { addMedicalCaseNote } from "@/lib/repositories/medicalCases.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, medicalCaseNoteSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const updated = await addMedicalCaseNote(id, admin.sub, parsed.data.body);
  if (!updated) return fail({ code: "not_found" }, 404);
  await writeAudit({
    actorId: admin.sub,
    action: "medicalCase.note",
    entityType: "MedicalCase",
    entityId: id,
  });
  return ok({ id });
}
