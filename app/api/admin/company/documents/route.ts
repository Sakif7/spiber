import { randomBytes } from "crypto";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/current-user";
import { rateLimit } from "@/lib/auth/rate-limit";
import { ok, fail } from "@/lib/http/respond";
import { getStorage } from "@/lib/storage";
import { getVaultKey, encryptVaultBlob } from "@/lib/crypto/vault";
import { createCompanyDocument } from "@/lib/repositories/company-documents.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";

export const dynamic = "force-dynamic";

const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "text/csv",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
]);

/**
 * Company vault upload — SUPER-ADMIN only. The file is encrypted with
 * AES-256-GCM before it touches storage (private root), so even raw access to
 * the VPS volume/backups can't read it. Audited. Refuses to store plaintext:
 * no vault key configured → 503, never a silent fallback.
 */
export async function POST(req: Request) {
  const admin = await requireSuperAdmin();
  if (!admin) {
    const user = await getSessionUser();
    return fail(
      { code: user ? "forbidden" : "unauthorized" },
      user ? 403 : 401,
    );
  }
  const rl = rateLimit(`vault-upload:${admin.sub}`, 20, 60_000);
  if (!rl.ok) return fail({ code: "rate_limited" }, 429);

  const key = getVaultKey();
  if (!key) {
    return fail(
      {
        code: "vault_not_configured",
        message:
          "COMPANY_VAULT_KEY is not set (64 hex chars). Documents are stored encrypted only — set the key to enable the vault.",
      },
      503,
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail({ code: "no_file" }, 400);
  if (file.size > MAX_BYTES) return fail({ code: "too_large" }, 413);
  if (!ALLOWED.has(file.type)) return fail({ code: "bad_type" }, 415);

  const title =
    String(form?.get("title") ?? "")
      .trim()
      .slice(0, 160) || file.name.slice(0, 160);
  const folder = String(form?.get("folder") ?? "")
    .trim()
    .slice(0, 80);

  const plain = Buffer.from(await file.arrayBuffer());
  const blob = encryptVaultBlob(plain, key);
  const storageKey = `company-vault/${Date.now()}-${randomBytes(6).toString("hex")}.bin`;

  await getStorage().put({
    key: storageKey,
    body: blob,
    contentType: "application/octet-stream",
    private: true,
  });

  const doc = await createCompanyDocument({
    title,
    originalFilename: file.name,
    fileKey: storageKey,
    contentType: file.type,
    size: file.size,
    folder: folder || undefined,
    uploadedBy: admin.sub,
    uploadedByEmail: admin.email,
    encrypted: true,
  });

  await writeAudit({
    actorId: admin.sub,
    action: "companyDocument.upload",
    entityType: "CompanyDocument",
    entityId: String(doc._id),
    after: { title, filename: file.name, size: file.size, folder },
  });

  return ok({ id: String(doc._id), title });
}
