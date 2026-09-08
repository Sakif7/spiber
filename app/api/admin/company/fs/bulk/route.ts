import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { bulkSchema } from "@/lib/schemas/company-fs";
import {
  moveItems,
  copyItems,
  trashItems,
  restoreItems,
  purgeItems,
  type BulkOutcome,
} from "@/lib/services/company-fs.service";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { guardFs } from "../_guard";

export const dynamic = "force-dynamic";

/**
 * Apply one operation to a selection of folders and files.
 *
 * Items are independent, as in the inventory bulk endpoint: a failing item is
 * reported and the rest still apply, because a 40-item move that stops halfway
 * with a single status code tells the user nothing about what happened.
 */
export async function POST(req: Request) {
  const g = await guardFs("fs-bulk", 60);
  if (!g.ok) return g.res;

  const parsed = await parseJson(req, bulkSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const { op, folderIds, fileIds, targetId } = parsed.data;

  let result: BulkOutcome;
  switch (op) {
    case "move":
      result = await moveItems({ folderIds, fileIds, targetId }, g.actor);
      break;
    case "copy":
      result = await copyItems({ folderIds, fileIds, targetId }, g.actor);
      break;
    case "trash":
      result = await trashItems({ folderIds, fileIds });
      break;
    case "restore":
      result = await restoreItems({ folderIds, fileIds });
      break;
    case "purge":
      result = await purgeItems({ folderIds, fileIds });
      break;
  }

  await writeAudit(
    {
      actorId: g.actor.sub,
      action: `companyFs.${op}`,
      entityType: "CompanyVault",
      entityId: targetId ?? "root",
      after: {
        folderIds,
        fileIds,
        targetId,
        folders: result.folders,
        files: result.files,
        failed: result.failed,
      },
    },
    req,
  );

  return ok(result);
}
