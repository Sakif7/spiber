import { fail } from "@/lib/http/respond";
import { myDocumentPdf } from "@/lib/services/documents/document-signing.service";
import { guardMe } from "../../../_guard";

export const dynamic = "force-dynamic";

/** The document as sent (or completed), for one of its recipients. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guardMe("document-read", 60);
  if (!g.ok) return g.res;
  const { id } = await params;
  const file = await myDocumentPdf(g.session, id, req);
  if (!file) return fail({ code: "not_found" }, 404);
  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${file.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
