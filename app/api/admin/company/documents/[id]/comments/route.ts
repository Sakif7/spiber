import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { addCommentSchema } from "@/lib/schemas/authored-document";
import { getDocument } from "@/lib/services/documents/authored-document.service";
import {
  addComment,
  reviewStateOf,
} from "@/lib/services/documents/document-review.service";
import { documentStatus, guardDocuments } from "../../_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** The threads and the reviewers, as they stand (the editor polls this). */
export async function GET(_req: Request, { params }: Params) {
  const g = await guardDocuments("comments-read", 240);
  if (!g.ok) return g.res;
  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc) return fail({ code: "not_found" }, 404);
  return ok(reviewStateOf(doc));
}

/** The author's own comment on the text. */
export async function POST(req: Request, { params }: Params) {
  const g = await guardDocuments("comments", 60);
  if (!g.ok) return g.res;
  const { id } = await params;
  const parsed = await parseJson(req, addCommentSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const res = await addComment(
    id,
    parsed.data,
    { sub: g.actor.sub, isAdmin: true },
    "author",
    req,
  );
  if (!res.ok) {
    return fail(
      { code: res.code, message: res.detail },
      documentStatus(res.code),
    );
  }
  return ok(res.data);
}
