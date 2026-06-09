import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { jobApplicationCreateSchema } from "@/lib/schemas/career";
import { createApplication } from "@/lib/services/career.service";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { getStorage } from "@/lib/storage";
import { jobApplicationNumber } from "@/lib/ids";

export const dynamic = "force-dynamic";

// resumeKey must be one of OUR résumé uploads — a `resumes/<file>` key with no
// path traversal — so an application can't reference another private object
// (course assets, software binaries, …).
const RESUME_KEY = /^resumes\/[A-Za-z0-9._-]+$/;

/** Public job-application submission. No auth — rate-limited + honeypot-guarded. */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`careers-apply:${ip}`, 5, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }

  const parsed = await parseJson(req, jobApplicationCreateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  // Honeypot: a real user can't see/fill `website`. Drop silently with a
  // realistic-looking reference so bots can't distinguish it from success.
  if (parsed.data.website) {
    return ok({ applicationNumber: jobApplicationNumber() });
  }

  // Validate the résumé key shape, then confirm the file actually exists in
  // private storage before persisting (no bogus / dangling-key applications).
  if (!RESUME_KEY.test(parsed.data.resumeKey)) {
    return fail({ code: "invalid_resume" }, 400);
  }
  const resumeObj = await getStorage()
    .getObject({ key: parsed.data.resumeKey, range: "bytes=0-0" })
    .catch(() => null);
  if (!resumeObj) return fail({ code: "invalid_resume" }, 400);
  await resumeObj.body.cancel().catch(() => {});

  const result = await createApplication(parsed.data, {
    ip,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });
  if (!result.ok) return fail({ code: result.code }, 409);

  return ok({ applicationNumber: result.applicationNumber });
}
