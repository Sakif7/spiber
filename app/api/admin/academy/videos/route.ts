import { getSessionUser } from "@/lib/auth/current-user";
import { isAdmin } from "@/lib/auth/rbac";
import { ok, fail } from "@/lib/http/respond";
import { getVideoProvider } from "@/lib/video";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";

const MAX_BYTES = 200 * 1024 * 1024; // 200MB (basic upload ceiling)
const ALLOWED = new Set([
  // video
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
  "video/ogg",
  // audio (lessons can be audio-only)
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
]);

/** Upload a lesson video → returns the provider `uid` to store on the lesson. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!isAdmin(user)) return fail({ code: "forbidden" }, 403);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail({ code: "no_file" }, 400);
  if (file.size > MAX_BYTES) return fail({ code: "too_large" }, 413);
  if (file.type && !ALLOWED.has(file.type)) {
    return fail({ code: "bad_type" }, 415);
  }

  try {
    const body = Buffer.from(await file.arrayBuffer());
    const result = await getVideoProvider().upload({
      body,
      contentType: file.type || "video/mp4",
      filename: file.name || "video.mp4",
    });
    return ok(result);
  } catch (e) {
    logger.error("video upload failed", e);
    return fail({ code: "upload_failed" }, 502);
  }
}

/** Poll processing status: GET /api/admin/academy/videos?uid=... */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!isAdmin(user)) return fail({ code: "forbidden" }, 403);

  const uid = new URL(req.url).searchParams.get("uid");
  if (!uid) return fail({ code: "no_uid" }, 400);

  try {
    const status = await getVideoProvider().getStatus(uid);
    return ok(status);
  } catch (e) {
    logger.error("video status failed", e);
    return fail({ code: "status_failed" }, 502);
  }
}
