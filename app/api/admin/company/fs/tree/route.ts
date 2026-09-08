import { ok } from "@/lib/http/respond";
import { getTree } from "@/lib/services/company-fs.service";
import { guardFs } from "../_guard";

export const dynamic = "force-dynamic";

/** The whole live folder tree, for the sidebar and the move/copy picker. */
export async function GET() {
  const g = await guardFs("fs-tree", 240);
  if (!g.ok) return g.res;
  return ok({ folders: await getTree() });
}
