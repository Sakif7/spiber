import { randomBytes } from "node:crypto";
import { requireAdmin } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/auth/rate-limit";
import { ok, fail } from "@/lib/http/respond";
import { getStorage } from "@/lib/storage";
import { mimeMatchesBytes, extensionFor } from "@/lib/uploads/sniff";
import { writeAudit } from "@/lib/repositories/audit.repo";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB (covers PDF handouts)
// Note: image/svg+xml is intentionally excluded — SVGs can carry inline scripts
// and would be a stored-XSS vector when served same-origin.
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "application/pdf",
]);

export async function POST(req: Request) {
  // requireAdmin (not isAdmin on the raw claims): an access token asserts its
  // roles for 15 minutes, so a demoted or disabled admin could otherwise keep
  // uploading. Every other admin route already re-validates against the DB.
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  if (!rateLimit(`admin-upload:${admin.sub}`, 30, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail({ code: "no_file" }, 400);
  if (file.size > MAX_BYTES) return fail({ code: "too_large" }, 413);
  if (!ALLOWED.has(file.type)) return fail({ code: "bad_type" }, 415);

  const body = Buffer.from(await file.arrayBuffer());
  // The declared type is client-supplied; confirm the bytes agree before we
  // store the file and later serve it back under that Content-Type.
  if (!mimeMatchesBytes(file.type, body)) {
    return fail({ code: "bad_type" }, 415);
  }

  // Gated course resources (PDF handouts) upload with visibility=private so they
  // land in the private root and are only served through /api/media/resource.
  const isPrivate = form?.get("visibility") === "private";

  // Extension from the verified MIME type, not the client's filename, and a
  // crypto-random suffix (Math.random is predictable and these keys address
  // public objects).
  const ext = extensionFor(file.type) ?? "bin";
  const rand = randomBytes(16).toString("hex");
  const key = `${isPrivate ? "resources" : "products"}/${Date.now()}-${rand}.${ext}`;

  const { url } = await getStorage().put({
    key,
    body,
    contentType: file.type,
    private: isPrivate,
  });
  await writeAudit({
    actorId: admin.sub,
    action: "upload.create",
    entityType: "Upload",
    entityId: key,
    after: {
      filename: file.name.slice(0, 200),
      size: file.size,
      contentType: file.type,
      visibility: isPrivate ? "private" : "public",
    },
  });

  // `url` is the public URL (empty for private); `key` is the raw storage key,
  // used for gated course resources streamed through /api/media/resource.
  return ok({ url, key });
}
