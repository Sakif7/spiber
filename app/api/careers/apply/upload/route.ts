import { randomBytes } from "node:crypto";
import { ok, fail } from "@/lib/http/respond";
import { getStorage } from "@/lib/storage";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
// Résumés only: PDF + Word. (No images/SVG — avoids stored-XSS + keeps it a CV.)
const ALLOWED = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
};

/**
 * Magic-byte sniff: the claimed MIME type is client-spoofable, so confirm the
 * binary really is a PDF / DOCX(zip) / legacy DOC(OLE) before storing it — this
 * blocks a renamed executable being uploaded and later opened by HR.
 */
function looksLikeDocument(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  // %PDF
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46)
    return true;
  // PK.. (ZIP container → .docx)
  if (buf[0] === 0x50 && buf[1] === 0x4b) return true;
  // OLE compound file (legacy .doc): D0 CF 11 E0
  if (buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0)
    return true;
  return false;
}

/**
 * Public résumé upload for the careers apply form. No auth, but rate-limited,
 * strictly typed/sized, content-sniffed, and stored as a PRIVATE object with a
 * crypto-random key — only downloadable by admins via the gated
 * /api/admin/career/applications/[id]/resume route.
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`careers-upload:${ip}`, 10, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail({ code: "no_file" }, 400);
  if (file.size > MAX_BYTES) return fail({ code: "too_large" }, 413);
  if (!ALLOWED.has(file.type)) return fail({ code: "bad_type" }, 415);

  const body = Buffer.from(await file.arrayBuffer());
  if (!looksLikeDocument(body)) return fail({ code: "bad_type" }, 415);

  const ext = EXT[file.type] ?? "pdf";
  // Crypto-random, unguessable key (128 bits) so a private résumé can't be
  // referenced by guessing.
  const rand = randomBytes(16).toString("hex");
  const key = `resumes/${Date.now()}-${rand}.${ext}`;

  await getStorage().put({
    key,
    body,
    contentType: file.type,
    private: true,
  });

  return ok({ key, name: file.name.slice(0, 200) });
}
