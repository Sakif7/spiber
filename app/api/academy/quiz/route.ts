import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { quizSubmitSchema } from "@/lib/schemas/enrollment";
import { submitQuiz } from "@/lib/services/enrollment.service";
import { getSessionUser } from "@/lib/auth/current-user";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!rateLimit(`quiz:${clientIp(req)}`, 30, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
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
