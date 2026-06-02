import { requireAdmin } from "@/lib/auth/guard";
import { parseJson } from "@/lib/http/validate";
import { ok, fail } from "@/lib/http/respond";
import { enrollmentTransitionSchema } from "@/lib/schemas/enrollment";
import { transitionEnrollment } from "@/lib/services/enrollment.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;

  const parsed = await parseJson(req, enrollmentTransitionSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const result = await transitionEnrollment(id, parsed.data.to, {
    note: parsed.data.note,
  });
  if (!result.ok) {
    return fail({ code: result.code }, result.code === "not_found" ? 404 : 409);
  }
  await writeAudit({
    actorId: admin.sub,
    action: `enrollment.${parsed.data.to}`,
    entityType: "Enrollment",
    entityId: id,
    after: { to: parsed.data.to },
  });
  return ok({ status: parsed.data.to });
}
