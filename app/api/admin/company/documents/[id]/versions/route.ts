import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { snapshotSchema } from "@/lib/schemas/authored-document";
import { fileVersion } from "@/lib/services/documents/authored-document.service";
import { documentStatus, guardDocuments } from "../../_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** File the current text as a numbered version (PDF in the vault). */
export async function POST(req: Request, { params }: Params) {
  const g = await guardDocuments("version", 30);
  if (!g.ok) return g.res;
  const { id } = await params;
  const parsed = await parseJson(req, snapshotSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const res = await fileVersion(id, "snapshot", g.actor, {
    note: parsed.data.note,
    req,
  });
  if (!res.ok) {
    return fail(
      { code: res.code, message: res.detail },
      documentStatus(res.code),
    );
  }
  return ok(res.data);
}
