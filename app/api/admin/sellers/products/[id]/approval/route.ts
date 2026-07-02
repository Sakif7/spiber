import { z } from "zod";
import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { setProductApproval } from "@/lib/repositories/products.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";

const approvalSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reason: z.string().max(1000).optional(),
});

/** Approve or reject a seller-owned product listing. */
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

  const updated = await setProductApproval(
    id,
    parsed.data.status,
    parsed.data.reason,
  );
  if (!updated) return fail({ code: "not_found" }, 404);
  await writeAudit({
    actorId: admin.sub,
    action: `product.${parsed.data.status}`,
    entityType: "Product",
    entityId: id,
    after: { approvalStatus: parsed.data.status },
  });
  return ok({ status: parsed.data.status });
}
