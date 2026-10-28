import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { purchaseTransitionSchema } from "@/lib/schemas/systems";
import { transitionPurchase } from "@/lib/services/software.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, purchaseTransitionSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const result = await transitionPurchase(id, parsed.data.to, {
    note: parsed.data.note,
    refundReference: parsed.data.refundReference,
    actorId: admin.sub,
  });
  if (!result.ok) {
    return fail({ code: result.code }, result.code === "not_found" ? 404 : 409);
  }
  await writeAudit(
    {
      actorId: admin.sub,
      action: `software_purchase.${parsed.data.to}`,
      entityType: "SoftwarePurchase",
      entityId: id,
      after: {
        to: parsed.data.to,
        ...(parsed.data.refundReference
          ? { refundReference: parsed.data.refundReference }
          : {}),
      },
    },
    req,
  );
  return ok({ status: parsed.data.to });
}
