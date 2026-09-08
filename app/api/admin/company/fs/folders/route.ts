import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { folderCreateSchema } from "@/lib/schemas/company-fs";
import { createFolderIn } from "@/lib/services/company-fs.service";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { guardFs, fsFail } from "../_guard";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await guardFs("fs-write");
  if (!g.ok) return g.res;

  const parsed = await parseJson(req, folderCreateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const res = await createFolderIn(
    { name: parsed.data.name, parentId: parsed.data.parentId ?? null },
    g.actor,
  );
  if (!res.ok) return fsFail(res.code);

  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "companyFolder.create",
      entityType: "CompanyFolder",
      entityId: res.data.id,
      after: { name: res.data.name, parentId: res.data.parentId },
    },
    req,
  );
  return ok(res.data);
}
