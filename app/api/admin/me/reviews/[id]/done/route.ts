import { ok, fail } from "@/lib/http/respond";
import { finishReview } from "@/lib/services/documents/document-review.service";
import { guardReviewer, reviewStatus } from "../../_guard";

export const dynamic = "force-dynamic";

/** "I am done reviewing" — the author is told. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guardReviewer("done", 20);
  if (!g.ok) return g.res;
  const { id } = await params;
  const res = await finishReview(id, g.actor, req);
  if (!res.ok) {
    return fail(
      { code: res.code, message: res.detail },
      reviewStatus(res.code),
    );
  }
  return ok(res.data);
}
