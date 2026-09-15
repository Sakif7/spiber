import { fail } from "@/lib/http/respond";
import { companyContext } from "@/lib/pdf/engine/context";
import { documentSettingsSchema } from "@/lib/schemas/authored-document";
import { exportDocx } from "@/lib/documents/docx/export";
import { getDocument } from "@/lib/services/documents/authored-document.service";
import { printBodyFor } from "@/lib/services/documents/document-signing.service";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { guardDocuments } from "../../_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** The document as a Word file — the text as it stands, letterhead and all. */
export async function GET(req: Request, { params }: Params) {
  const g = await guardDocuments("docx", 30);
  if (!g.ok) return g.res;
  const { id } = await params;
  const doc = await getDocument(id);
  if (!doc) return fail({ code: "not_found" }, 404);
  const bytes = await exportDocx({
    body: await printBodyFor(doc),
    settings: documentSettingsSchema.parse(doc.settings ?? {}),
    company: companyContext(),
    number: doc.number ?? null,
    title: doc.title,
  });
  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "document.export.docx",
      entityType: "AuthoredDocument",
      entityId: id,
      after: { bytes: bytes.length },
    },
    req,
  ).catch(() => undefined);
  const stem = (doc.number ?? doc.title).replace(/[^\w.-]+/g, "-").slice(0, 80);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${stem}.docx"`,
      "Cache-Control": "no-store",
    },
  });
}
