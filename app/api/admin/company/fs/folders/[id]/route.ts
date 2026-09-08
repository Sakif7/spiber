import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { folderUpdateSchema } from "@/lib/schemas/company-fs";
import {
  renameFolderById,
  moveFolder,
} from "@/lib/services/company-fs.service";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { guardFs, fsFail } from "../../_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Rename and/or move a folder. Both arrive on the same request because the UI
 * can do either from the same dialog, and a move that collides with an existing
 * name has to rename in the same write (see moveFolderSubtree).
 */
export async function PATCH(req: Request, { params }: Params) {
  const g = await guardFs("fs-write");
  if (!g.ok) return g.res;
  const { id } = await params;

  const parsed = await parseJson(req, folderUpdateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  if (parsed.data.parentId !== undefined) {
    const moved = await moveFolder(id, parsed.data.parentId);
    if (!moved.ok) return fsFail(moved.code);
    await writeAudit(
      {
        actorId: g.actor.sub,
        action: "companyFolder.move",
        entityType: "CompanyFolder",
        entityId: id,
        after: { parentId: parsed.data.parentId, name: moved.data.name },
      },
      req,
    );
  }

  if (parsed.data.name !== undefined) {
    const renamed = await renameFolderById(id, parsed.data.name);
    if (!renamed.ok) return fsFail(renamed.code);
    await writeAudit(
      {
        actorId: g.actor.sub,
        action: "companyFolder.rename",
        entityType: "CompanyFolder",
        entityId: id,
        after: { name: parsed.data.name },
      },
      req,
    );
  }

  return ok({ id });
}
