import { getCourseByIdLean, findLesson } from "@/lib/repositories/courses.repo";
import { hasCourseAccess } from "@/lib/repositories/enrollments.repo";
import { getSessionUser } from "@/lib/auth/current-user";
import { getStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Gated delivery of a lesson resource (PDF handout / image / other course
 * material). Same access model as the video/audio route: free-preview lessons
 * are open; everything else requires an active enrollment. The file is streamed
 * from storage (R2/local) via the authenticated S3 API with HTTP Range support,
 * so paid course material is never reachable through a shareable public URL.
 * PDFs are served `inline` so the browser viewer can open them in place.
 */
export async function GET(
  req: Request,
  {
    params,
  }: { params: Promise<{ courseId: string; lessonId: string; index: string }> },
) {
  const { courseId, lessonId, index } = await params;
  const i = Number.parseInt(index, 10);
  if (!Number.isInteger(i) || i < 0) {
    return new Response("Not found", { status: 404 });
  }

  let course;
  try {
    course = await getCourseByIdLean(courseId);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!course) return new Response("Not found", { status: 404 });

  const lesson = findLesson(course, lessonId);
  const resource = lesson?.resources?.[i];
  if (!resource?.fileKey) return new Response("Not found", { status: 404 });

  if (!lesson!.isFreePreview) {
    const user = await getSessionUser();
    if (!user) return new Response("Unauthorized", { status: 401 });
    const allowed = await hasCourseAccess(user.sub, courseId);
    if (!allowed) return new Response("Forbidden", { status: 403 });
  }

  const range = req.headers.get("range") ?? undefined;
  const obj = await getStorage().getObject({
    key: toStorageKey(resource.fileKey),
    range,
  });
  if (!obj) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  headers.set("Content-Type", obj.contentType);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, no-store");
  // Open inline (PDF viewer / image) rather than forcing a download, while
  // still suggesting a sensible filename.
  headers.set(
    "Content-Disposition",
    `inline; filename="${sanitizeFilename(resource.name)}"`,
  );
  if (obj.contentLength != null) {
    headers.set("Content-Length", String(obj.contentLength));
  }
  if (obj.contentRange) headers.set("Content-Range", obj.contentRange);

  return new Response(obj.body, { status: obj.status, headers });
}

/**
 * Resources now store the raw storage key. Older rows may hold a public URL
 * (R2 public base or the local `/uploads/<key>` path) — recover the key so
 * those keep streaming too.
 */
function toStorageKey(fileKey: string): string {
  if (/^https?:\/\//i.test(fileKey)) {
    try {
      return new URL(fileKey).pathname.replace(/^\/+/, "");
    } catch {
      return fileKey;
    }
  }
  return fileKey.replace(/^\/?uploads\//, "");
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "resource";
}
