import { getSessionUser } from "@/lib/auth/current-user";
import { requireAdmin } from "@/lib/auth/guard";
import { getPartnerApplicationByIdLean } from "@/lib/repositories/partnerApplications.repo";
import { auditDocumentView } from "@/lib/audit/document-view";
import { getStorage } from "@/lib/storage";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Gated delivery of a PARTNER-APPLICATION document (credentials/accreditations).
 * Admin-only, audited on every access, streamed from PRIVATE storage with Range
 * support — never a public URL.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ appId: string; index: string }> },
) {
  const { appId, index } = await params;
  const i = Number.parseInt(index, 10);
  if (!Number.isInteger(i) || i < 0) {
    return new Response("Not found", { status: 404 });
  }

  const admin = await requireAdmin();
  if (!admin) {
    const user = await getSessionUser();
    return new Response(user ? "Forbidden" : "Unauthorized", {
      status: user ? 403 : 401,
    });
  }

  let app;
  try {
    app = await getPartnerApplicationByIdLean(appId);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!app) return new Response("Not found", { status: 404 });

  const resource = app.documents?.[i];
  if (!resource?.fileKey) return new Response("Not found", { status: 404 });

  const range = req.headers.get("range") ?? undefined;
  // Fail-closed audit on EVERY request. This used to run only for a request
  // with no Range or one starting at byte 0, so `Range: bytes=1-` fetched the
  // document with no audit row at all; auditDocumentView dedupes by time.
  try {
    await auditDocumentView({
      actorId: admin.sub,
      action: "partnerApplication.document_view",
      entityType: "PartnerApplication",
      entityId: appId,
      after: { index: i, name: resource.name },
      req,
    });
  } catch (e) {
    logger.warn("partner audit write failed; denying access", e);
    return new Response("Audit unavailable", { status: 503 });
  }

  const obj = await getStorage().getObject({
    key: toStorageKey(resource.fileKey),
    range,
  });
  if (!obj) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  headers.set("Content-Type", obj.contentType);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, no-store");
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
  return name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "document";
}
