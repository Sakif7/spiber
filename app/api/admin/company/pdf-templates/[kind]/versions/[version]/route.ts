import { ok, fail } from "@/lib/http/respond";
import { getTemplateVersion } from "@/lib/services/pdf-template.service";
import { guardSales } from "../../../../sales/_guard";
import { parseKind } from "../../../_shared";

export const dynamic = "force-dynamic";

/** One published version in full (0 = the built-in), for "revert to…". */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ kind: string; version: string }> },
) {
  const g = await guardSales("pdf-templates");
  if (!g.ok) return g.res;
  const p = await params;
  const k = parseKind(p.kind);
  if (!k.ok) return k.res;
  const v = Number.parseInt(p.version, 10);
  if (!Number.isInteger(v) || v < 0) return fail({ code: "not_found" }, 404);
  const res = await getTemplateVersion(k.kind, v);
  if (!res) return fail({ code: "not_found" }, 404);
  return ok(res);
}
