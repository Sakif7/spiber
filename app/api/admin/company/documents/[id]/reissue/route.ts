import { ok, fail } from "@/lib/http/respond";
import { reissueDocument } from "@/lib/services/documents/document-signing.service";
import { documentStatus, guardDocuments } from "../../_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Unlock a sent document for changes; the next Send is a new round. */
export async function POST(req: Request, { params }: Params) {
  const g = await guardDocuments("reissue", 30);
  if (!g.ok) return g.res;
  const { id } = await params;
  const res = await reissueDocument(id, g.actor, req);
  if (!res.ok) {
    return fail(
      { code: res.code, message: res.detail },
      documentStatus(res.code),
    );
  }
  return ok(res.data);
}
