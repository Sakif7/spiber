import { requireAdmin } from "@/lib/auth/guard";
import { getApplicationByIdLean } from "@/lib/repositories/career.repo";
import { getStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Gated résumé download (admin only). Résumés are stored as PRIVATE objects and
 * are never reachable through a public URL — they stream from storage here only
 * after an admin check, with HTTP Range support and a download disposition.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return new Response("Forbidden", { status: 403 });
  const { id } = await params;

  const app = await getApplicationByIdLean(id).catch(() => null);
  if (!app?.resumeKey) return new Response("Not found", { status: 404 });

  const range = req.headers.get("range") ?? undefined;
  const obj = await getStorage().getObject({ key: app.resumeKey, range });
  if (!obj) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  headers.set("Content-Type", obj.contentType);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, no-store");
  headers.set(
    "Content-Disposition",
    `attachment; filename="${sanitizeFilename(app.resumeName ?? `resume-${app.applicationNumber}`)}"`,
  );
  if (obj.contentLength != null) {
    headers.set("Content-Length", String(obj.contentLength));
  }
  if (obj.contentRange) headers.set("Content-Range", obj.contentRange);

  return new Response(obj.body, { status: obj.status, headers });
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "resume";
}
