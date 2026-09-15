import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { replyCommentSchema } from "@/lib/schemas/authored-document";
import { replyToComment } from "@/lib/services/documents/document-review.service";
import { guardReviewer, reviewStatus } from "../../../_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; commentId: string }> };

/** A reviewer's reply in a thread. */
export async function POST(req: Request, { params }: Params) {
  const g = await guardReviewer("comments", 60);
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
    g.actor,
    "reviewer",
    req,
  );
  if (!res.ok) {
    return fail(
      { code: res.code, message: res.detail },
      reviewStatus(res.code),
    );
  }
  return ok(res.data);
}
