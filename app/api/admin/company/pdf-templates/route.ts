import { ok } from "@/lib/http/respond";
import { listOverview } from "@/lib/services/pdf-template.service";
import { guardSales } from "../sales/_guard";

export const dynamic = "force-dynamic";

/** Every document kind with its current version and whether a draft exists. */
export async function GET() {
  const g = await guardSales("pdf-templates");
  if (!g.ok) return g.res;
  return ok(await listOverview());
}
