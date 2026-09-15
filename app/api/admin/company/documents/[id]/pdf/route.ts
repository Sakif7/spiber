import { fail } from "@/lib/http/respond";
import {
  getDocument,
  renderDraftPdf,
} from "@/lib/services/documents/authored-document.service";
import { printBodyFor } from "@/lib/services/documents/document-signing.service";
import { documentStatus, guardDocuments } from "../../_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** The current draft printed now — a preview, nothing is filed. */
export async function GET(req: Request, { params }: Params) {
  const g = await guardDocuments("pdf", 30);
  if (!g.ok) return g.res;
  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc) return fail({ code: "not_found" }, 404);
  const res = await renderDraftPdf(doc, await printBodyFor(doc));
  if (!res.ok) {
    return fail(
      { code: res.code, message: res.detail },
      documentStatus(res.code),
    );
  }
  const download = new URL(req.url).searchParams.get("download") === "1";
  const name = `${(doc.number ?? doc.title).replace(/[^\w.-]+/g, "-")}.pdf`;
  return new Response(new Uint8Array(res.data.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": "no-store",
      "X-Pages": String(res.data.pages),
    },
  });
}
