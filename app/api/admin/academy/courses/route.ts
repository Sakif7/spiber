import { requireAdmin } from "@/lib/auth/guard";
import { parseJson } from "@/lib/http/validate";
import { ok, fail } from "@/lib/http/respond";
import { courseSchema } from "@/lib/schemas/academy";
import { createCourse } from "@/lib/repositories/courses.repo";
import { toCourseDoc } from "@/lib/services/course.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);

  const parsed = await parseJson(req, courseSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const data = toCourseDoc(parsed.data);
  try {
    const doc = await createCourse(data);
    await writeAudit({
      actorId: admin.sub,
      action: "course.create",
      entityType: "Course",
      entityId: String(doc._id),
      after: { slug: data.slug, status: data.status },
    });
    return ok({ id: String(doc._id) });
  } catch (e: unknown) {
    if ((e as { code?: number })?.code === 11000) {
      return fail({ code: "duplicate", message: "Slug already exists" }, 409);
    }
    throw e;
  }
}
