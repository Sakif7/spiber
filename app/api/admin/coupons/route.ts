import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { couponSchema } from "@/lib/schemas/coupon";
import { createCoupon } from "@/lib/repositories/coupons.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const parsed = await parseJson(req, couponSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  try {
    const doc = await createCoupon(parsed.data);
    await writeAudit({
      actorId: admin.sub,
      action: "coupon.create",
      entityType: "Coupon",
      entityId: String(doc._id),
      after: parsed.data,
    });
    return ok({ id: String(doc._id) });
  } catch (e: unknown) {
    if (
      typeof e === "object" &&
      e &&
      "code" in e &&
      (e as { code?: number }).code === 11000
    ) {
      return fail(
        { code: "duplicate", message: "Coupon code already exists" },
        409,
      );
    }
    throw e;
  }
}
