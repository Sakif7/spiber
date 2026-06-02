import { ok, fail } from "@/lib/http/respond";
import { requireAdmin } from "@/lib/auth/guard";
import { retryFulfillment } from "@/lib/services/software.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  try {
    const result = await retryFulfillment(id);
    if (!result.ok) {
      return fail(
        { code: result.code },
        result.code === "not_found" ? 404 : 409,
      );
    }
  } catch {
    return fail({ code: "fulfillment_failed" }, 502);
  }
  await writeAudit({
    actorId: admin.sub,
    action: "software_purchase.retry_fulfillment",
    entityType: "SoftwarePurchase",
    entityId: id,
  });
  return ok({ id });
}
