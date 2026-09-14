import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { sendDocumentSchema } from "@/lib/schemas/authored-document";
import { sendDocument } from "@/lib/services/documents/document-signing.service";
import { documentStatus, guardDocuments } from "../../_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Send: number it, lock it, file the "sent" PDF, tell the recipients. The
 * people in the signature slots sign; anyone listed here only reads.
 */
export async function POST(req: Request, { params }: Params) {
  const g = await guardDocuments("send", 30);
  if (!g.ok) return g.res;
  const { id } = await params;
  const parsed = await parseJson(req, sendDocumentSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const res = await sendDocument(id, parsed.data, g.actor, req);
  if (!res.ok) {
    return fail(
      { code: res.code, message: res.detail },
      documentStatus(res.code),
    );
  }
  return ok(res.data);
}
