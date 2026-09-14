import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { updateDocumentSchema } from "@/lib/schemas/authored-document";
import {
  deleteDraft,
  getDocument,
  updateDocument,
} from "@/lib/services/documents/authored-document.service";
import { documentStatus, guardDocuments } from "../_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** The document with its body, for the editor and the detail page. */
export async function GET(_req: Request, { params }: Params) {
  const g = await guardDocuments("read");
  if (!g.ok) return g.res;
  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc) return fail({ code: "not_found" }, 404);
  return ok({
    document: {
      id: String(doc._id),
      type: doc.type,
      number: doc.number ?? null,
      title: doc.title,
      status: doc.status,
      body: doc.body,
      rev: doc.rev,
      settings: doc.settings,
      updatedAt: doc.updatedAt.toISOString(),
      versions: (doc.versions ?? []).map((v) => ({
        n: v.n,
        label: v.label,
        note: v.note ?? null,
        pages: v.pages ?? null,
        createdAt: v.createdAt.toISOString(),
      })),
    },
  });
}

/** Autosave / settings; 409 `stale` means another tab saved first. */
export async function PATCH(req: Request, { params }: Params) {
  const g = await guardDocuments("save", 600);
  if (!g.ok) return g.res;
  const { id } = await params;
  const parsed = await parseJson(req, updateDocumentSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const res = await updateDocument(id, parsed.data, g.actor);
  if (!res.ok) {
    return fail(
      { code: res.code, message: res.detail },
      documentStatus(res.code),
    );
  }
  return ok(res.data);
}

export async function DELETE(req: Request, { params }: Params) {
  const g = await guardDocuments("write", 60);
  if (!g.ok) return g.res;
  const { id } = await params;
  const res = await deleteDraft(id, g.actor, req);
  if (!res.ok) return fail({ code: res.code }, documentStatus(res.code));
  return ok(res.data);
}
