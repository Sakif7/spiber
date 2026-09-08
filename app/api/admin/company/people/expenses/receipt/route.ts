import { ok, fail } from "@/lib/http/respond";
import {
  ensureFolderPath,
  uploadDocument,
} from "@/lib/services/company-fs.service";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { monthOf } from "@/lib/hr/months";
import { guardPeople, peopleStatus } from "../../_guard";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * File a receipt in the company vault and hand back its document id.
 *
 * Receipts are money evidence, so they go through the same encrypted vault as
 * every other company document rather than into public storage — and they are
 * read back through the existing gated, audited document route. Filed under
 * `HR / Expenses / <month>` so a year's receipts stay browsable.
 *
 * `uploadDocument` does the real validation: allowlist, magic-byte sniff,
 * extension cross-check, quota, and a 503 when no vault key is configured.
 */
export async function POST(req: Request) {
  const g = await guardPeople("expense-receipt", 30);
  if (!g.ok) return g.res;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail({ code: "no_file" }, 400);
  if (file.size === 0) return fail({ code: "empty_file" }, 400);
  if (file.size > MAX_BYTES) return fail({ code: "too_large" }, 413);

  // The month the receipt is filed under: the date it was spent when the form
  // sends one, otherwise today.
  const spentAt = String(form?.get("spentAt") ?? "");
  const month = /^\d{4}-\d{2}-\d{2}$/.test(spentAt)
    ? monthOf(new Date(`${spentAt}T00:00:00+06:00`))
    : monthOf(new Date());

  const folder = await ensureFolderPath(["HR", "Expenses", month], g.actor);
  if (!folder.ok) return fail({ code: folder.code }, peopleStatus(folder.code));

  const stored = await uploadDocument(
    {
      filename: file.name || "receipt",
      contentType: file.type || "application/octet-stream",
      body: Buffer.from(await file.arrayBuffer()),
      folderId: folder.data.id,
      source: { kind: "expense", id: "pending" },
    },
    g.actor,
  );
  if (!stored.ok) return fail({ code: stored.code }, peopleStatus(stored.code));

  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "expense.receipt_upload",
      entityType: "CompanyDocument",
      entityId: stored.id,
      after: { title: stored.title, month },
    },
    req,
  );
  return ok({ documentId: stored.id, title: stored.title });
}
