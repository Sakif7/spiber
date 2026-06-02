import { getCourseByIdLean, findLesson } from "@/lib/repositories/courses.repo";
import { hasCourseAccess } from "@/lib/repositories/enrollments.repo";
import { getSessionUser } from "@/lib/auth/current-user";
import { getStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Gated streaming of a lesson's video/audio. Free-preview lessons are open;
 * everything else requires an active enrollment. The object is streamed from
 * storage (R2/local) via the authenticated S3 API with HTTP Range support, so
 * protected media is never reachable through a shareable public URL.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ courseId: string; lessonId: string }> },
) {
  const { courseId, lessonId } = await params;

  let course;
  try {
    course = await getCourseByIdLean(courseId);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!course) return new Response("Not found", { status: 404 });

  const lesson = findLesson(course, lessonId);
  if (!lesson || !lesson.videoUid) {
    return new Response("Not found", { status: 404 });
  }

  if (!lesson.isFreePreview) {
    const user = await getSessionUser();
    if (!user) return new Response("Unauthorized", { status: 401 });
    const allowed = await hasCourseAccess(user.sub, courseId);
    if (!allowed) return new Response("Forbidden", { status: 403 });
  }

  const range = req.headers.get("range") ?? undefined;
  const obj = await getStorage().getObject({ key: lesson.videoUid, range });
  if (!obj) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  headers.set("Content-Type", obj.contentType);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, no-store");
  if (obj.contentLength != null) {
    headers.set("Content-Length", String(obj.contentLength));
  }
  if (obj.contentRange) headers.set("Content-Range", obj.contentRange);

  return new Response(obj.body, { status: obj.status, headers });
}
