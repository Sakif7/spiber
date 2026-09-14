import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import {
  createDocumentSchema,
  listDocumentsQuerySchema,
} from "@/lib/schemas/authored-document";
import {
  createDocument,
  listDocuments,
} from "@/lib/services/documents/authored-document.service";
import { guardDocuments } from "./_guard";

export const dynamic = "force-dynamic";

/** `?q=&type=&status=` — the documents list, newest change first. */
export async function GET(req: Request) {
  const g = await guardDocuments("list");
  if (!g.ok) return g.res;
  const parsed = listDocumentsQuerySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.error.issues }, 400);
  }
  const rows = await listDocuments(parsed.data);
  return ok({
    documents: rows.map((r) => ({
      id: String(r._id),
      type: r.type,
      number: r.number,
      title: r.title,
      status: r.status,
      updatedAt: r.updatedAt.toISOString(),
      createdAt: r.createdAt.toISOString(),
      sentAt: r.sentAt ? r.sentAt.toISOString() : null,
      versions: r.versions,
      recipients: r.recipients,
      pending: r.pending,
    })),
  });
}

/** A new draft; the editor opens on it. */
export async function POST(req: Request) {
  const g = await guardDocuments("write", 60);
  if (!g.ok) return g.res;
  const parsed = await parseJson(req, createDocumentSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const doc = await createDocument(parsed.data, g.actor, req);
  return ok({ id: String(doc._id) });
}
