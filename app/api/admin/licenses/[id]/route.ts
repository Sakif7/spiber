import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { licenseStatusUpdateSchema } from "@/lib/schemas/systems";
import { updateLicenseStatus } from "@/lib/services/license.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, licenseStatusUpdateSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const result = await updateLicenseStatus(id, parsed.data.status);
  if (!result.ok) {
    return fail({ code: result.code }, result.code === "not_found" ? 404 : 409);
  }
  await writeAudit({
    actorId: admin.sub,
    action: `license.${parsed.data.status}`,
    entityType: "License",
    entityId: id,
    after: { status: parsed.data.status },
  });
  return ok({ status: parsed.data.status });
}
