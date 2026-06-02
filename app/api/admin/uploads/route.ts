import { getSessionUser } from "@/lib/auth/current-user";
import { isAdmin } from "@/lib/auth/rbac";
import { ok, fail } from "@/lib/http/respond";
import { getStorage } from "@/lib/storage";

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB (covers PDF handouts)
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/svg+xml",
  "application/pdf",
]);

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!isAdmin(user)) return fail({ code: "forbidden" }, 403);

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
  const key = `products/${Date.now()}-${rand}.${ext}`;
  const body = Buffer.from(await file.arrayBuffer());

  const { url } = await getStorage().put({ key, body, contentType: file.type });
  return ok({ url });
}
