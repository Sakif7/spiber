import { ok, fail } from "@/lib/http/respond";
import { createDocumentSchema } from "@/lib/schemas/authored-document";
import { importDocx, MAX_DOCX_BYTES } from "@/lib/documents/docx/import";
import {
  createDocument,
  updateDocument,
} from "@/lib/services/documents/authored-document.service";
import { guardDocuments } from "../_guard";

export const dynamic = "force-dynamic";

/**
 * A new document from a Word file: kind, title and language as on the New
 * document panel, the text read from the .docx. Multipart: `file`, `type`,
 * `title`, `language`.
 */
export async function POST(req: Request) {
  const g = await guardDocuments("import", 10);
  if (!g.ok) return g.res;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail({ code: "no_file" }, 400);
  if (file.size > MAX_DOCX_BYTES) return fail({ code: "too_large" }, 413);
  const meta = createDocumentSchema.safeParse({
    type: form?.get("type"),
    title:
      String(form?.get("title") ?? "").trim() ||
      file.name.replace(/\.docx$/i, "").slice(0, 200),
    language: form?.get("language") ?? "en",
  });
  if (!meta.success) {
    return fail({ code: "invalid_input", details: meta.error.issues }, 400);
  }
  const imported = await importDocx(Buffer.from(await file.arrayBuffer()));
  if (!imported.ok) {
    return fail(
      { code: imported.code },
      imported.code === "too_large" ? 413 : 400,
    );
  }
  const doc = await createDocument(meta.data, g.actor, req);
  const saved = await updateDocument(
    String(doc._id),
    { body: imported.data.body, rev: 0 },
    g.actor,
  );
  if (!saved.ok) return fail({ code: saved.code, message: saved.detail }, 400);
  return ok({ id: String(doc._id), warnings: imported.data.warnings });
}
