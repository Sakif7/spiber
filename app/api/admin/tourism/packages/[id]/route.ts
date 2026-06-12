import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { packageUpdateSchema } from "@/lib/schemas/tourism-catalog";
import {
  updatePackageContent,
  deletePackageContent,
} from "@/lib/services/tourism-catalog.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, packageUpdateSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const result = await updatePackageContent(id, parsed.data);
  if (!result.ok) return fail({ code: result.code }, 404);
  await writeAudit({
    actorId: admin.sub,
    action: "tourism.package.update",
    entityType: "TreatmentPackage",
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
  const result = await deletePackageContent(id);
  if (!result.ok) return fail({ code: result.code }, 404);
  await writeAudit({
    actorId: admin.sub,
    action: "tourism.package.delete",
    entityType: "TreatmentPackage",
    entityId: id,
  });
  return ok({ id });
}
