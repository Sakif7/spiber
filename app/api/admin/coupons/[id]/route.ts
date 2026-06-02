import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { couponSchema } from "@/lib/schemas/coupon";
import { updateCoupon } from "@/lib/repositories/coupons.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, couponSchema.partial());
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  await updateCoupon(id, parsed.data);
  await writeAudit({
    actorId: admin.sub,
    action: "coupon.update",
    entityType: "Coupon",
    entityId: id,
    after: parsed.data,
  });
  return ok({ id });
}
