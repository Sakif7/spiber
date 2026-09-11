import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { templateDocSchema } from "@/lib/schemas/pdf-template";
import { discardDraft, saveDraft } from "@/lib/services/pdf-template.service";
import { guardSales } from "../../../sales/_guard";
import { parseKind, templateStatus } from "../../_shared";

export const dynamic = "force-dynamic";

/** Save the working copy. */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const g = await guardSales("pdf-templates");
  if (!g.ok) return g.res;
  const k = parseKind((await params).kind);
  if (!k.ok) return k.res;
  const parsed = await parseJson(req, templateDocSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const res = await saveDraft(k.kind, parsed.data, g.actor);
  if (!res.ok) {
    return fail(
      { code: res.code, details: res.issues },
      templateStatus(res.code),
    );
  }
  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "pdfTemplate.draftSave",
      entityType: "PdfTemplate",
      entityId: k.kind,
      after: { blocks: parsed.data.blocks.length },
    },
    req,
  );
  return ok(res.data);
}

/** Throw the working copy away; the published version is untouched. */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const g = await guardSales("pdf-templates");
  if (!g.ok) return g.res;
  const k = parseKind((await params).kind);
  if (!k.ok) return k.res;
  const res = await discardDraft(k.kind);
  if (!res.ok) return fail({ code: res.code }, templateStatus(res.code));
  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "pdfTemplate.draftDiscard",
      entityType: "PdfTemplate",
      entityId: k.kind,
    },
    req,
  );
  return ok(res.data);
}
