import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requestReviewSchema } from "@/lib/schemas/authored-document";
import { requestReview } from "@/lib/services/documents/document-review.service";
import { documentStatus, guardDocuments } from "../../_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Ask people to read the draft and comment; the document goes "in review". */
export async function POST(req: Request, { params }: Params) {
  const g = await guardDocuments("review", 30);
  if (!g.ok) return g.res;
  const { id } = await params;
  const parsed = await parseJson(req, requestReviewSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const res = await requestReview(id, parsed.data, g.actor, req);
  if (!res.ok) {
    return fail(
      { code: res.code, message: res.detail },
      documentStatus(res.code),
    );
  }
  return ok(res.data);
}
