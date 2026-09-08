import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { documentUpdateSchema } from "@/lib/schemas/company-fs";
import {
  renameDocumentById,
  moveDocument,
} from "@/lib/services/company-fs.service";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { guardFs, fsFail } from "../../_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Rename and/or re-file a document. The stored binary never changes. */
export async function PATCH(req: Request, { params }: Params) {
  const g = await guardFs("fs-write");
  if (!g.ok) return g.res;
  const { id } = await params;

  const parsed = await parseJson(req, documentUpdateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  if (parsed.data.folderId !== undefined) {
    const moved = await moveDocument(id, parsed.data.folderId, g.actor);
    if (!moved.ok) return fsFail(moved.code);
    await writeAudit(
      {
        actorId: g.actor.sub,
        action: "companyDocument.move",
        entityType: "CompanyDocument",
        entityId: id,
        after: { folderId: parsed.data.folderId, title: moved.data.title },
      },
      req,
    );
  }

  if (parsed.data.title !== undefined) {
    const renamed = await renameDocumentById(id, parsed.data.title);
    if (!renamed.ok) return fsFail(renamed.code);
    await writeAudit(
      {
        actorId: g.actor.sub,
        action: "companyDocument.rename",
        entityType: "CompanyDocument",
        entityId: id,
        after: { title: parsed.data.title },
      },
      req,
    );
  }

  return ok({ id });
}
