import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { enrollInputSchema } from "@/lib/schemas/enrollment";
import { enrollCourse } from "@/lib/services/enrollment.service";
import { getSessionUser } from "@/lib/auth/current-user";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { startDigitalPayment } from "@/lib/services/payment.service";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!rateLimit(`enroll:${clientIp(req)}`, 10, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const user = await getSessionUser();
  if (!user) return fail({ code: "unauthorized" }, 401);

  const parsed = await parseJson(req, enrollInputSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const result = await enrollCourse({
    courseId: parsed.data.courseId,
    userId: user.sub,
    email: user.email,
    idempotencyKey: parsed.data.idempotencyKey,
    couponCode: parsed.data.couponCode,
  });
  if (!result.ok) {
    return fail(
      { code: result.code },
      result.code === "course_not_found" ? 404 : 409,
    );
  }
  // Paid online when it can be: straight to PayStation, as checkout does.
  let redirectUrl: string | undefined;
  if (result.enrollment.status === "pending") {
    const started = await startDigitalPayment(
      "enrollment",
      result.enrollment.enrollmentNumber,
      { userId: user.sub },
      { locale: parsed.data.locale },
    ).catch(() => null);
    if (started?.ok) redirectUrl = started.redirectUrl;
  }
  return ok({
    enrollmentNumber: result.enrollment.enrollmentNumber,
    status: result.enrollment.status,
    totalMinor: result.enrollment.totalMinor,
    redirectUrl,
  });
}
