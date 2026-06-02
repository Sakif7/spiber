import { getSessionUser } from "@/lib/auth/current-user";
import { isAdmin } from "@/lib/auth/rbac";
import { ok, fail } from "@/lib/http/respond";
import { getStorage } from "@/lib/storage";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";

const MAX_BYTES = 200 * 1024 * 1024; // 200MB

/**
 * Upload a software product's downloadable asset (admin-only, trusted). Returns
 * the storage KEY (not a public URL) — the asset is delivered through the
 * enrollment-gated /api/media/software/[productId] route, never publicly.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!isAdmin(user)) return fail({ code: "forbidden" }, 403);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail({ code: "no_file" }, 400);
  if (file.size > MAX_BYTES) return fail({ code: "too_large" }, 413);

  const ext = file.name.includes(".")
    ? file.name
        .split(".")
        .pop()!
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
    : "bin";
  const rand = Math.random().toString(36).slice(2, 10);
  const key = `software/${Date.now()}-${rand}.${ext}`;

  try {
    const body = Buffer.from(await file.arrayBuffer());
    await getStorage().put({
      key,
      body,
      contentType: file.type || "application/octet-stream",
    });
    return ok({ key, name: file.name });
  } catch (e) {
    logger.error("software asset upload failed", e);
    return fail({ code: "upload_failed" }, 502);
  }
}
