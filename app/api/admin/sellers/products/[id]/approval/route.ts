import { z } from "zod";
import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { moderateSellerProduct } from "@/lib/services/seller-product.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

const approvalSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reason: z.string().max(1000).optional(),
});

/**
 * Approve or reject a seller listing — or, for a LIVE listing with a pending
 * content update, approve/discard that update (the live version keeps serving
 * either way). Emails the seller with the decision + reason.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, approvalSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const result = await moderateSellerProduct(
    id,
    parsed.data.status,
    parsed.data.reason,
  );
  if (!result.ok) return fail({ code: result.code }, 404);

  await writeAudit({
    actorId: admin.sub,
    action: `product.${result.kind === "update" ? "update_" : ""}${parsed.data.status}`,
    entityType: "Product",
    entityId: id,
    after: {
      approvalStatus: parsed.data.status,
      kind: result.kind,
      ...(parsed.data.reason ? { reason: parsed.data.reason } : {}),
    },
  });
  return ok({ status: parsed.data.status, kind: result.kind });
}
