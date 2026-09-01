import { getSessionUser } from "@/lib/auth/current-user";
import { ok, fail } from "@/lib/http/respond";
import { rateLimit } from "@/lib/auth/rate-limit";
import { getStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per verification document
// Scans/photos of licences + certificates. No SVG (script vector).
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

/**
 * PRIVATE upload of credit-application documents (trade licence, TIN/BIN
 * certificates, bank statements). Any logged-in user may upload while applying;
 * files land in PRIVATE storage and are only ever served to admins via
 * /api/media/credit-application/[id]/[index]. Returns the raw storage `key` —
 * private objects have no public URL.
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return fail({ code: "unauthorized" }, 401);

  const rl = rateLimit(`credit-apply-upload:${user.sub}`, 12, 10 * 60_000);
  if (!rl.ok) return fail({ code: "rate_limited" }, 429);

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
  const key = `credit-applications/${user.sub}/${Date.now()}-${rand}.${ext}`;
  const body = Buffer.from(await file.arrayBuffer());

  await getStorage().put({
    key,
    body,
    contentType: file.type,
    private: true,
  });
  return ok({ key, filename: file.name, size: file.size, mime: file.type });
}
