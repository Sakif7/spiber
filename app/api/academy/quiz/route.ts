import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { quizSubmitSchema } from "@/lib/schemas/enrollment";
import { submitQuiz } from "@/lib/services/enrollment.service";
import { getSessionUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return fail({ code: "unauthorized" }, 401);

  const parsed = await parseJson(req, quizSubmitSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const result = await submitQuiz(
    user.sub,
    parsed.data.courseId,
    parsed.data.lessonId,
    parsed.data.answers,
  );
  if (!result.ok) {
    return fail(
      { code: result.code },
      result.code === "not_enrolled" ? 403 : 404,
    );
  }
  return ok(result);
}
