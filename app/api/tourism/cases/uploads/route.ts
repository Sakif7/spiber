import { ok, fail } from "@/lib/http/respond";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { getStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB (lab PDFs / scans)
// image/svg+xml is intentionally excluded (stored-XSS vector when served same-origin).
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "application/pdf",
]);

/**
 * Patient upload of a medical report at case-submission time. PUBLIC but
 * rate-limited + consent-gated. The file lands in PRIVATE storage (outside the
 * statically-served dir) and is only reachable through the auth-gated
 * /api/media/case route — never a public URL. Returns the raw storage KEY (not
 * a URL) which the case-create call submits as a document descriptor.
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`case-upload:${ip}`, 10, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail({ code: "no_file" }, 400);
  // Privacy consent must be explicitly accepted to upload health data.
  if (form?.get("consent") !== "true") {
    return fail({ code: "consent_required" }, 400);
  }
  if (file.size > MAX_BYTES) return fail({ code: "too_large" }, 413);
  if (!ALLOWED.has(file.type)) return fail({ code: "bad_type" }, 415);

  const ext = file.name.includes(".")
    ? file.name
        .split(".")
        .pop()!
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
    : "bin";
  const rand = Math.random().toString(36).slice(2, 10);
  const key = `cases/pending/${Date.now()}-${rand}.${ext}`;
  const body = Buffer.from(await file.arrayBuffer());

  await getStorage().put({ key, body, contentType: file.type, private: true });
  // Raw private storage key — never a public URL.
  return ok({ key, name: file.name, contentType: file.type });
}
