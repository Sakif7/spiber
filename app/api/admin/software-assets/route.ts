import { randomBytes } from "node:crypto";
import { requireAdmin } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/auth/rate-limit";
import { ok, fail } from "@/lib/http/respond";
import { getStorage } from "@/lib/storage";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";

const MAX_BYTES = 200 * 1024 * 1024; // 200MB

/**
 * Upload a software product's downloadable asset (admin-only, trusted). Returns
 * the storage KEY (not a public URL) — the asset is delivered through the
 * enrollment-gated /api/media/software/[productId] route, never publicly.
 *
 * Deliberately no MIME allowlist or content sniff: the payload is an arbitrary
 * installer (zip, exe, dmg, img). What contains it is that the object is
 * private, is served only to a customer with a paid purchase, and always goes
 * out as an attachment.
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  // 200 MB per upload, so keep the ceiling low.
  if (!rateLimit(`software-asset-upload:${admin.sub}`, 10, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail({ code: "no_file" }, 400);
  if (file.size > MAX_BYTES) return fail({ code: "too_large" }, 413);

  // Extension kept from the filename (installers vary) but sanitised and
  // bounded; the random half of the key is crypto-strong, not Math.random.
  const ext = file.name.includes(".")
    ? file.name
        .split(".")
        .pop()!
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .slice(0, 12)
    : "bin";
  const rand = randomBytes(16).toString("hex");
  const key = `software/${Date.now()}-${rand}.${ext}`;

  try {
    const body = Buffer.from(await file.arrayBuffer());
    // Private: software assets are delivered only via the gated /api/media route.
    await getStorage().put({
      key,
      body,
      contentType: file.type || "application/octet-stream",
      private: true,
    });
    await writeAudit({
      actorId: admin.sub,
      action: "upload.create",
      entityType: "Upload",
      entityId: key,
      after: {
        filename: file.name.slice(0, 200),
        size: file.size,
        contentType: file.type || "application/octet-stream",
        visibility: "private",
        area: "software",
      },
    });
    return ok({ key, name: file.name });
  } catch (e) {
    logger.error("software asset upload failed", e);
    return fail({ code: "upload_failed" }, 502);
  }
}
