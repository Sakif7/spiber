import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { hospitalCreateSchema } from "@/lib/schemas/tourism-catalog";
import { createHospitalContent } from "@/lib/services/tourism-catalog.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const parsed = await parseJson(req, hospitalCreateSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const result = await createHospitalContent(parsed.data);
  if (!result.ok) return fail({ code: result.code }, 409);
  await writeAudit({
    actorId: admin.sub,
    action: "tourism.hospital.create",
    entityType: "Hospital",
    entityId: result.id,
  });
  return ok({ id: result.id });
}
