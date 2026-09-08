import { randomBytes } from "node:crypto";
import { requireAdmin } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/auth/rate-limit";
import { ok, fail } from "@/lib/http/respond";
import { getStorage } from "@/lib/storage";
import { mimeMatchesBytes, extensionFor } from "@/lib/uploads/sniff";
import { writeAudit } from "@/lib/repositories/audit.repo";

export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "application/pdf",
]);

/**
 * Admin-side private upload for Spiber Tourism (e.g. partner-application
 * credentials, or case documents added by a case manager). Always PRIVATE —
 * the file is served only through the gated /api/media/{case,partner} routes.
 * Returns the raw storage KEY (never a public URL).
 */
export async function POST(req: Request) {
  // DB-validated: these are patient and partner documents, so a demoted admin
  // riding a still-valid access token must not be able to add to them.
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  if (!rateLimit(`tourism-upload:${admin.sub}`, 30, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail({ code: "no_file" }, 400);
  if (file.size > MAX_BYTES) return fail({ code: "too_large" }, 413);
  if (!ALLOWED.has(file.type)) return fail({ code: "bad_type" }, 415);

  const body = Buffer.from(await file.arrayBuffer());
  // The declared type is client-supplied; confirm the bytes agree.
  if (!mimeMatchesBytes(file.type, body)) {
    return fail({ code: "bad_type" }, 415);
  }

  const ext = extensionFor(file.type) ?? "bin";
  const rand = randomBytes(16).toString("hex");
  const key = `tourism/${Date.now()}-${rand}.${ext}`;

  await getStorage().put({ key, body, contentType: file.type, private: true });

  await writeAudit({
    actorId: admin.sub,
    action: "upload.create",
    entityType: "Upload",
    entityId: key,
    after: {
      filename: file.name.slice(0, 200),
      size: file.size,
      contentType: file.type,
      visibility: "private",
      area: "tourism",
    },
  });

  return ok({ key, name: file.name, contentType: file.type });
}
