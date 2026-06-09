import { requireAdmin } from "@/lib/auth/guard";
import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { jobSchema } from "@/lib/schemas/career";
import { saveJob } from "@/lib/services/career.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

export const dynamic = "force-dynamic";

/** Create a job posting. */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);

  const parsed = await parseJson(req, jobSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const result = await saveJob(parsed.data);
  if (!result.ok) return fail({ code: result.code }, 409);

  await writeAudit({
    actorId: admin.sub,
    action: "job.create",
    entityType: "JobPosting",
    entityId: result.id,
    after: { slug: result.slug, status: parsed.data.status },
  });

  return ok({ id: result.id, slug: result.slug });
}
