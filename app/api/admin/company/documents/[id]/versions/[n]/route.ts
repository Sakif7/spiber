import { fail } from "@/lib/http/respond";
import { getCompanyDocumentById } from "@/lib/repositories/company-documents.repo";
import { readDocumentBytes } from "@/lib/services/company-fs.service";
import { auditDocumentView } from "@/lib/audit/document-view";
import { getDocument } from "@/lib/services/documents/authored-document.service";
import { guardDocuments } from "../../../_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; n: string }> };

/** The PDF filed as version `n`, straight from the vault (audited view). */
export async function GET(req: Request, { params }: Params) {
  const g = await guardDocuments("version-read", 60);
  if (!g.ok) return g.res;
  const { id, n } = await params;
  const doc = await getDocument(id);
  const version = doc?.versions?.find((v) => v.n === Number(n));
  if (!doc || !version?.vaultFileId) return fail({ code: "not_found" }, 404);
  const file = await getCompanyDocumentById(String(version.vaultFileId));
  if (!file) return fail({ code: "not_found" }, 404);
  const bytes = await readDocumentBytes(file);
  if (!bytes) return fail({ code: "vault_not_configured" }, 503);
  await auditDocumentView({
    actorId: g.actor.sub,
    action: "document.version.view",
    entityType: "AuthoredDocument",
    entityId: id,
    after: { version: version.n, title: file.title },
    req,
  }).catch(() => undefined);
  const download = new URL(req.url).searchParams.get("download") === "1";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${file.title}"`,
      "Cache-Control": "no-store",
    },
  });
}
