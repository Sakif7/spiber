import { requireAdmin } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/auth/rate-limit";
import { auditDocumentView } from "@/lib/audit/document-view";
import { getApplicationByIdLean } from "@/lib/repositories/career.repo";
import { getStorage } from "@/lib/storage";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Gated résumé download (admin only). Résumés are stored as PRIVATE objects and
 * are never reachable through a public URL — they stream from storage here only
 * after an admin check, with HTTP Range support and a download disposition.
 *
 * A résumé is applicant personal data, so access is AUDITED fail-closed, the
 * same as the other gated document routes: no audit row, no document.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return new Response("Forbidden", { status: 403 });
  if (!rateLimit(`resume-download:${admin.sub}`, 60, 60_000).ok) {
    return new Response("Too many requests", { status: 429 });
  }
  const { id } = await params;

  const app = await getApplicationByIdLean(id).catch(() => null);
  if (!app?.resumeKey) return new Response("Not found", { status: 404 });

  try {
    await auditDocumentView({
      actorId: admin.sub,
      action: "application.resume_view",
      entityType: "JobApplication",
      entityId: id,
      after: {
        applicationNumber: app.applicationNumber,
        filename: app.resumeName,
      },
      req,
    });
  } catch (e) {
    logger.warn("résumé audit write failed; denying access", e);
    return new Response("Audit unavailable", { status: 503 });
  }

  const range = req.headers.get("range") ?? undefined;
  const obj = await getStorage().getObject({ key: app.resumeKey, range });
  if (!obj) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  headers.set("Content-Type", obj.contentType);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
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
