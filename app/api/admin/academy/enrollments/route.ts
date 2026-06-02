import mongoose from "mongoose";
import { requireAdmin } from "@/lib/auth/guard";
import { parseJson } from "@/lib/http/validate";
import { ok, fail } from "@/lib/http/respond";
import { manualEnrollSchema } from "@/lib/schemas/enrollment";
import { enrollCourse } from "@/lib/services/enrollment.service";
import { findUserByEmail } from "@/lib/repositories/users.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";

export const dynamic = "force-dynamic";

/** Admin manual enroll: grant a user access to a course without payment. */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);

  const parsed = await parseJson(req, manualEnrollSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const user = await findUserByEmail(parsed.data.email);
  if (!user) return fail({ code: "user_not_found" }, 404);

  const result = await enrollCourse({
    courseId: parsed.data.courseId,
    userId: String(user._id),
    email: parsed.data.email,
    idempotencyKey: `admin-${new mongoose.Types.ObjectId().toString()}`,
    grant: true,
  });
  if (!result.ok) {
    return fail(
      { code: result.code },
      result.code === "course_not_found" ? 404 : 409,
    );
  }
  await writeAudit({
    actorId: admin.sub,
    action: "enrollment.grant",
    entityType: "Enrollment",
    entityId: result.enrollment.enrollmentNumber,
    after: { courseId: parsed.data.courseId, email: parsed.data.email },
  });
  return ok({ enrollmentNumber: result.enrollment.enrollmentNumber });
}
