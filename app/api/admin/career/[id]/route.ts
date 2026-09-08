import { requireAdmin } from "@/lib/auth/guard";
import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { jobSchema } from "@/lib/schemas/career";
import { saveJob } from "@/lib/services/career.service";
import { softDeleteJob } from "@/lib/repositories/career.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";

export const dynamic = "force-dynamic";

/** Update a job posting. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;

  const parsed = await parseJson(req, jobSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const result = await saveJob(parsed.data, id);
  if (!result.ok) {
    return fail({ code: result.code }, result.code === "not_found" ? 404 : 409);
  }

  await writeAudit({
    actorId: admin.sub,
    action: "job.update",
    entityType: "JobPosting",
    entityId: id,
    after: { slug: result.slug, status: parsed.data.status },
  });

  return ok({ id: result.id, slug: result.slug });
}

/** Soft-delete a job posting. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;

  // An unknown or already-deleted id is a 404, not a silent success with an
  // audit row claiming something was deleted.
  const deleted = await softDeleteJob(id).catch(() => false);
  if (!deleted) return fail({ code: "not_found" }, 404);

  await writeAudit({
    actorId: admin.sub,
    action: "job.delete",
    entityType: "JobPosting",
    entityId: id,
  });

  return ok({ id });
}
