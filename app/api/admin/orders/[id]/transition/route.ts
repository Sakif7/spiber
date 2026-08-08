import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { orderTransitionSchema } from "@/lib/schemas/order";
import { transitionOrder } from "@/lib/services/order.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, orderTransitionSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const result = await transitionOrder(id, parsed.data.to, {
    note: parsed.data.note,
    internalNote: parsed.data.internalNote,
    trackingNumber: parsed.data.trackingNumber,
  });
  if (!result.ok) {
    return fail({ code: result.code }, result.code === "not_found" ? 404 : 409);
  }
  await writeAudit({
    actorId: admin.sub,
    action: `order.${parsed.data.to}`,
    entityType: "Order",
    entityId: id,
    after: { to: parsed.data.to },
  });
  return ok({ status: parsed.data.to });
}
