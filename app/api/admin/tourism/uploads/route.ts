import { getSessionUser } from "@/lib/auth/current-user";
import { isAdmin } from "@/lib/auth/rbac";
import { ok, fail } from "@/lib/http/respond";
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
 * Admin-side private upload for Spiber Tourism (e.g. partner-application
 * credentials, or case documents added by a case manager). Always PRIVATE —
 * the file is served only through the gated /api/media/{case,partner} routes.
 * Returns the raw storage KEY (never a public URL).
 */
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
  const key = `tourism/${Date.now()}-${rand}.${ext}`;
  const body = Buffer.from(await file.arrayBuffer());

  await getStorage().put({ key, body, contentType: file.type, private: true });
  return ok({ key, name: file.name, contentType: file.type });
}
