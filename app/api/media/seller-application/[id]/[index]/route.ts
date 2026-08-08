import { getSessionUser } from "@/lib/auth/current-user";
import { requireAdmin } from "@/lib/auth/guard";
import { getSellerApplicationByIdLean } from "@/lib/repositories/seller-applications.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { getStorage } from "@/lib/storage";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Gated delivery of a SELLER-APPLICATION KYC document (trade license, NID, …).
 * Admin-only, audited on every access, streamed from PRIVATE storage with
 * Range support — never a public URL. Mirrors /api/media/partner.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  const { id, index } = await params;
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
    app = await getSellerApplicationByIdLean(id);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!app) return new Response("Not found", { status: 404 });

  const doc = app.documents?.[i];
  if (!doc?.key) return new Response("Not found", { status: 404 });

  const range = req.headers.get("range") ?? undefined;
  const isInitialView = !range || /^bytes=0-/.test(range);
  if (isInitialView) {
    // Fail-closed audit: no audit row, no document.
    try {
      await writeAudit({
        actorId: admin.sub,
        action: "sellerApplication.document_view",
        entityType: "SellerApplication",
        entityId: id,
        after: { index: i, label: doc.label, filename: doc.filename },
      });
    } catch (e) {
      logger.warn("seller-application audit write failed; denying access", e);
      return new Response("Audit unavailable", { status: 503 });
    }
  }

  const obj = await getStorage().getObject({ key: doc.key, range });
  if (!obj) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  headers.set("Content-Type", obj.contentType);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, no-store");
  headers.set(
    "Content-Disposition",
    `inline; filename="${sanitizeFilename(doc.filename)}"`,
  );
  if (obj.contentLength != null) {
    headers.set("Content-Length", String(obj.contentLength));
  }
  if (obj.contentRange) headers.set("Content-Range", obj.contentRange);

  return new Response(obj.body, { status: obj.status, headers });
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "document";
}
