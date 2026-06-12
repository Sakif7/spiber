import { ok, fail } from "@/lib/http/respond";
import { rateLimit, clientIp } from "@/lib/auth/rate-limit";
import { getStorage } from "@/lib/storage";

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
 * Public upload of a partner-application document (credentials/accreditation).
 * Rate-limited; stored PRIVATE; served only via the gated /api/media/partner
 * route. Returns the raw storage KEY.
 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!rateLimit(`partner-upload:${ip}`, 10, 60_000).ok) {
    return fail({ code: "rate_limited" }, 429);
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail({ code: "no_file" }, 400);
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
  const key = `partners/pending/${Date.now()}-${rand}.${ext}`;
  const body = Buffer.from(await file.arrayBuffer());

  await getStorage().put({ key, body, contentType: file.type, private: true });
  return ok({ key, name: file.name, contentType: file.type });
}
