import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { doctorCreateSchema } from "@/lib/schemas/tourism-catalog";
import { createDoctorContent } from "@/lib/services/tourism-catalog.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const parsed = await parseJson(req, doctorCreateSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const result = await createDoctorContent(parsed.data);
  if (!result.ok) return fail({ code: result.code }, 409);
  await writeAudit({
    actorId: admin.sub,
    action: "tourism.doctor.create",
    entityType: "Doctor",
    entityId: result.id,
  });
  return ok({ id: result.id });
}
