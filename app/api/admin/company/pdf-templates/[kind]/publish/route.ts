import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { publishInputSchema } from "@/lib/schemas/pdf-template";
import { publish } from "@/lib/services/pdf-template.service";
import { guardSales } from "../../../sales/_guard";
import { parseKind, templateStatus } from "../../_shared";

export const dynamic = "force-dynamic";

/** Publish the draft as the next version; new documents use it from now on. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const g = await guardSales("pdf-templates");
  if (!g.ok) return g.res;
  const k = parseKind((await params).kind);
  if (!k.ok) return k.res;
  const parsed = await parseJson(req, publishInputSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const res = await publish(k.kind, g.actor, parsed.data.note);
  if (!res.ok) {
    return fail(
      { code: res.code, details: res.issues },
      templateStatus(res.code),
    );
  }
  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "pdfTemplate.publish",
      entityType: "PdfTemplate",
      entityId: `${k.kind}:v${res.data.version}`,
      after: { ...res.data, note: parsed.data.note ?? null },
    },
    req,
  );
  return ok(res.data);
}
