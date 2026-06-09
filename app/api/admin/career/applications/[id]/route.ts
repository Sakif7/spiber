import { requireAdmin } from "@/lib/auth/guard";
import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { applicationStatusUpdateSchema } from "@/lib/schemas/career";
import {
  updateApplicationStatus,
  softDeleteApplication,
} from "@/lib/repositories/career.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";

export const dynamic = "force-dynamic";

/** Update an application's status. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;

  const parsed = await parseJson(req, applicationStatusUpdateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const updated = await updateApplicationStatus(id, parsed.data.status);
  if (!updated) return fail({ code: "not_found" }, 404);

  await writeAudit({
    actorId: admin.sub,
    action: "application.status",
    entityType: "JobApplication",
    entityId: id,
    after: { status: parsed.data.status },
  });

  return ok({ id, status: parsed.data.status });
}

/** Soft-delete an application. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;

  await softDeleteApplication(id);
  await writeAudit({
    actorId: admin.sub,
    action: "application.delete",
    entityType: "JobApplication",
    entityId: id,
  });

  return ok({ id });
}
