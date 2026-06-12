import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { doctorUpdateSchema } from "@/lib/schemas/tourism-catalog";
import {
  updateDoctorContent,
  deleteDoctorContent,
} from "@/lib/services/tourism-catalog.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, doctorUpdateSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const result = await updateDoctorContent(id, parsed.data);
  if (!result.ok) return fail({ code: result.code }, 404);
  await writeAudit({
    actorId: admin.sub,
    action: "tourism.doctor.update",
    entityType: "Doctor",
    entityId: id,
  });
  return ok({ id });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const result = await deleteDoctorContent(id);
  if (!result.ok) return fail({ code: result.code }, 404);
  await writeAudit({
    actorId: admin.sub,
    action: "tourism.doctor.delete",
    entityType: "Doctor",
    entityId: id,
  });
  return ok({ id });
}
