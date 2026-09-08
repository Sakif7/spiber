import { ok } from "@/lib/http/respond";
import { fail } from "@/lib/http/respond";
import { listQuerySchema } from "@/lib/schemas/company-fs";
import { listChildren } from "@/lib/services/company-fs.service";
import { guardFs, fsFail } from "../fs/_guard";

export const dynamic = "force-dynamic";

/**
 * Browse a folder: its subfolders, its files, the breadcrumb and vault usage.
 * Also serves the trash view and recursive search, which are the same listing
 * with a different predicate.
 */
export async function GET(req: Request) {
  const g = await guardFs("fs-list", 240);
  if (!g.ok) return g.res;

  const url = new URL(req.url);
  const parsed = listQuerySchema.safeParse({
    folder: url.searchParams.get("folder") ?? undefined,
    sort: url.searchParams.get("sort") ?? undefined,
    dir: url.searchParams.get("dir") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    recursive: url.searchParams.get("recursive") ?? false,
    trash: url.searchParams.get("trash") ?? false,
  });
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.error.issues }, 400);
  }

  const res = await listChildren({
    folderId: parsed.data.folder ?? null,
    sort: parsed.data.sort,
    dir: parsed.data.dir,
    q: parsed.data.q,
    recursive: parsed.data.recursive,
    trash: parsed.data.trash,
  });
  if (!res.ok) return fsFail(res.code);
  return ok(res.data);
}
