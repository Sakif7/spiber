import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { creditApplicationNoteSchema } from "@/lib/schemas/credit";
import { addCreditApplicationNote } from "@/lib/repositories/credit-applications.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, creditApplicationNoteSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const updated = await addCreditApplicationNote(
    id,
    admin.sub,
    parsed.data.body,
  );
  if (!updated) return fail({ code: "not_found" }, 404);
  await writeAudit({
    actorId: admin.sub,
    action: "creditApplication.note",
    entityType: "CreditApplication",
    entityId: id,
  });
  return ok({});
}
