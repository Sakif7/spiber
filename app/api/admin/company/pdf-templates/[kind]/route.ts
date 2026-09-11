import { ok } from "@/lib/http/respond";
import { getOverview } from "@/lib/services/pdf-template.service";
import { guardSales } from "../../sales/_guard";
import { parseKind } from "../_shared";

export const dynamic = "force-dynamic";

/** The current template, the draft if any, the version history, the built-in. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const g = await guardSales("pdf-templates");
  if (!g.ok) return g.res;
  const k = parseKind((await params).kind);
  if (!k.ok) return k.res;
  return ok(await getOverview(k.kind));
}
