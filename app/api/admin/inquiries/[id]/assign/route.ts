import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { inquiryAssignSchema } from "@/lib/schemas/inquiry";
import { setInquiryAssignee } from "@/lib/repositories/inquiries.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, inquiryAssignSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const updated = await setInquiryAssignee(id, parsed.data.assignedTo);
  if (!updated) return fail({ code: "not_found" }, 404);
  await writeAudit({
    actorId: admin.sub,
    action: "inquiry.assign",
    entityType: "Inquiry",
    entityId: id,
    after: { assignedTo: parsed.data.assignedTo },
  });
  return ok({ id });
}
