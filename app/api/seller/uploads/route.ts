import { requireSeller } from "@/lib/auth/guard";
import { ok, fail } from "@/lib/http/respond";
import { rateLimit } from "@/lib/auth/rate-limit";
import { getStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB per product/logo image
// Images only (no SVG — script-injection vector; no PDF — this is imagery).
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

/**
 * PUBLIC image upload for the seller portal (product photos, store logo).
 * The admin `/api/admin/uploads` is admin-gated, so sellers get their own
 * `requireSeller`-guarded endpoint with the same storage pipeline.
 */
export async function POST(req: Request) {
  const session = await requireSeller();
  if (!session) return fail({ code: "forbidden" }, 403);

  const rl = rateLimit(`seller-upload:${session.claims.sub}`, 30, 10 * 60_000);
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
  const key = `sellers/${String(session.seller._id)}/${Date.now()}-${rand}.${ext}`;
  const body = Buffer.from(await file.arrayBuffer());

  const { url } = await getStorage().put({
    key,
    body,
    contentType: file.type,
  });
  return ok({ url, key });
}
