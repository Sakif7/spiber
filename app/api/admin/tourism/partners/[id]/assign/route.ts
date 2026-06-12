import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { partnerApplicationAssignSchema } from "@/lib/schemas/partner-application";
import { setPartnerApplicationAssignee } from "@/lib/repositories/partnerApplications.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, partnerApplicationAssignSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const updated = await setPartnerApplicationAssignee(
    id,
    parsed.data.assignedTo,
  );
  if (!updated) return fail({ code: "not_found" }, 404);
  await writeAudit({
    actorId: admin.sub,
    action: "partnerApplication.assign",
    entityType: "PartnerApplication",
    entityId: id,
    after: { assignedTo: parsed.data.assignedTo },
  });
  return ok({ id });
}
