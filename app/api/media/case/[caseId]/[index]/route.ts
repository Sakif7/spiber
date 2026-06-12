import { getSessionUser } from "@/lib/auth/current-user";
import { requireAdmin } from "@/lib/auth/guard";
import { getMedicalCaseByIdLean } from "@/lib/repositories/medicalCases.repo";
import { canViewCaseDocuments } from "@/lib/services/case-access";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { getStorage } from "@/lib/storage";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Gated delivery of a MEDICAL CASE document (personal health data). Viewing is
 * restricted to admins / the assigned case manager — NEVER the patient — and is
 * AUDITED on every access. The file streams from PRIVATE storage via the
 * authenticated S3/local API with HTTP Range support, so reports are never
 * reachable through a public/guessable URL. Audit is fail-closed: if the audit
 * write fails we deny rather than leak the document.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ caseId: string; index: string }> },
) {
  const { caseId, index } = await params;
  const i = Number.parseInt(index, 10);
  if (!Number.isInteger(i) || i < 0) {
    return new Response("Not found", { status: 404 });
  }

  // Admin session, re-validated against the DB (revoked/disabled admins fail).
  const admin = await requireAdmin();
  if (!admin) {
    const user = await getSessionUser();
    return new Response(user ? "Forbidden" : "Unauthorized", {
      status: user ? 403 : 401,
    });
  }

  let caseDoc;
  try {
    caseDoc = await getMedicalCaseByIdLean(caseId);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!caseDoc) return new Response("Not found", { status: 404 });

  const assignedTo = caseDoc.assignedTo ? String(caseDoc.assignedTo) : null;
  if (!canViewCaseDocuments(admin, assignedTo)) {
    return new Response("Forbidden", { status: 403 });
  }

  const resource = caseDoc.documents?.[i];
  if (!resource?.fileKey) return new Response("Not found", { status: 404 });

  const range = req.headers.get("range") ?? undefined;
  // Audit the first/full request (range start 0 or no range) to record the view
  // without flooding the log on every PDF-viewer byte-range re-request.
  const isInitialView = !range || /^bytes=0-/.test(range);
  if (isInitialView) {
    try {
      await writeAudit({
        actorId: admin.sub,
        action: "medicalCase.document_view",
        entityType: "MedicalCase",
        entityId: caseId,
        after: { index: i, name: resource.name },
      });
    } catch (e) {
      logger.warn("medical-case audit write failed; denying access", e);
      return new Response("Audit unavailable", { status: 503 });
    }
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

/** Recover a storage key from a stored key or a legacy public URL. */
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
