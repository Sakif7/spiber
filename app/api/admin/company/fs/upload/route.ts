import { ok, fail } from "@/lib/http/respond";
import {
  uploadDocument,
  MAX_UPLOAD_BYTES,
  type UploadOutcome,
} from "@/lib/services/company-fs.service";
import { vaultConfigured } from "@/lib/crypto/vault";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { guardFs } from "../_guard";

export const dynamic = "force-dynamic";

/** One request may carry a whole drag-and-drop selection. */
const MAX_FILES = 25;

/**
 * Upload one or more files into a folder.
 *
 * Files are reported individually: a 20-file drop where one is the wrong type
 * should store the other 19 and say which failed, rather than rejecting the
 * lot. The response is therefore always 200 unless the request itself is
 * unusable, and the caller reads the per-file outcomes.
 */
export async function POST(req: Request) {
  const g = await guardFs("fs-upload", 60);
  if (!g.ok) return g.res;

  if (!vaultConfigured()) {
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
  if (!form) return fail({ code: "invalid_input" }, 400);

  const folderRaw = String(form.get("folderId") ?? "").trim();
  const folderId = folderRaw && folderRaw !== "null" ? folderRaw : null;

  const files = form
    .getAll("file")
    .filter((f): f is File => f instanceof File)
    .slice(0, MAX_FILES);
  if (files.length === 0) return fail({ code: "no_file" }, 400);

  const results: UploadOutcome[] = [];
  for (const file of files) {
    if (file.size > MAX_UPLOAD_BYTES) {
      results.push({ ok: false, filename: file.name, code: "too_large" });
      continue;
    }
    const res = await uploadDocument(
      {
        filename: file.name,
        contentType: file.type,
        body: Buffer.from(await file.arrayBuffer()),
        folderId,
      },
      g.actor,
    );
    results.push(res);
    if (res.ok) {
      await writeAudit(
        {
          actorId: g.actor.sub,
          action: "companyDocument.upload",
          entityType: "CompanyDocument",
          entityId: res.id,
          after: {
            title: res.title,
            filename: file.name,
            size: file.size,
            folderId,
          },
        },
        req,
      );
    }
  }

  const stored = results.filter((r) => r.ok).length;
  return ok({ stored, failed: results.length - stored, results });
}
