import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import {
  replyCommentSchema,
  resolveCommentSchema,
} from "@/lib/schemas/authored-document";
import {
  replyToComment,
  resolveComment,
} from "@/lib/services/documents/document-review.service";
import { documentStatus, guardDocuments } from "../../../_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; commentId: string }> };

/** Resolve or reopen a thread — the author's call. */
export async function PATCH(req: Request, { params }: Params) {
  const g = await guardDocuments("comments", 60);
  if (!g.ok) return g.res;
  const { id, commentId } = await params;
  const parsed = await parseJson(req, resolveCommentSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const res = await resolveComment(
    id,
    commentId,
    parsed.data.resolved,
    g.actor,
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

/** The author's reply in a thread. */
export async function POST(req: Request, { params }: Params) {
  const g = await guardDocuments("comments", 60);
  if (!g.ok) return g.res;
  const { id, commentId } = await params;
  const parsed = await parseJson(req, replyCommentSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const res = await replyToComment(
    id,
    commentId,
    parsed.data.text,
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
