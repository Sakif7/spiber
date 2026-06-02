import { requireAdmin } from "@/lib/auth/guard";
import { parseJson } from "@/lib/http/validate";
import { ok, fail } from "@/lib/http/respond";
import { courseSchema } from "@/lib/schemas/academy";
import {
  updateCourse,
  softDeleteCourse,
} from "@/lib/repositories/courses.repo";
import { toCourseDoc } from "@/lib/services/course.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;

  const parsed = await parseJson(req, courseSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const data = toCourseDoc(parsed.data);
  try {
    const doc = await updateCourse(id, data);
    if (!doc) return fail({ code: "not_found" }, 404);
    await writeAudit({
      actorId: admin.sub,
      action: "course.update",
      entityType: "Course",
      entityId: id,
      after: { slug: data.slug, status: data.status },
    });
    return ok({ id });
  } catch (e: unknown) {
    if ((e as { code?: number })?.code === 11000) {
      return fail({ code: "duplicate", message: "Slug already exists" }, 409);
    }
    throw e;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;

  await softDeleteCourse(id);
  await writeAudit({
    actorId: admin.sub,
    action: "course.delete",
    entityType: "Course",
    entityId: id,
  });
  return ok({ id });
}
