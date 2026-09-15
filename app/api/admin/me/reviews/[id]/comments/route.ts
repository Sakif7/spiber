import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { addCommentSchema } from "@/lib/schemas/authored-document";
import {
  addComment,
  reviewFor,
} from "@/lib/services/documents/document-review.service";
import { guardReviewer, reviewStatus } from "../../_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** The threads as they stand, for a document this person may review. */
export async function GET(_req: Request, { params }: Params) {
  const g = await guardReviewer("comments-read", 240);
  if (!g.ok) return g.res;
  const { id } = await params;
  const desk = await reviewFor(g.actor, id);
  if (!desk) return fail({ code: "not_found" }, 404);
  return ok(desk.state);
}

/** A reviewer's comment on the text. */
export async function POST(req: Request, { params }: Params) {
  const g = await guardReviewer("comments", 60);
  if (!g.ok) return g.res;
  const { id } = await params;
  const parsed = await parseJson(req, addCommentSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const res = await addComment(id, parsed.data, g.actor, "reviewer", req);
  if (!res.ok) {
    return fail(
      { code: res.code, message: res.detail },
      reviewStatus(res.code),
    );
  }
  return ok(res.data);
}
