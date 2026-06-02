import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { provisioningUpdateSchema } from "@/lib/schemas/systems";
import { updateProvisioningStatus } from "@/lib/services/provisioning.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

/**
 * Update a provisioning task (tracking the external-app activation). The actual
 * activation happens in the external app (e.g. ZenHcare) by its super admin;
 * here an admin records progress / marks it done.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, provisioningUpdateSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const result = await updateProvisioningStatus(id, parsed.data.status, {
    note: parsed.data.note,
    actorId: admin.sub,
  });
  if (!result.ok) return fail({ code: result.code }, 404);

  await writeAudit({
    actorId: admin.sub,
    action: `provisioning.${parsed.data.status}`,
    entityType: "ProvisioningTask",
    entityId: id,
    after: { status: parsed.data.status },
  });
  return ok({ status: parsed.data.status });
}
