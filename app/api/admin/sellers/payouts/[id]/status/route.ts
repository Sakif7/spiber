import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { sellerPayoutStatusUpdateSchema } from "@/lib/schemas/seller-commission";
import { updatePayoutStatus } from "@/lib/services/seller-commission.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, sellerPayoutStatusUpdateSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const result = await updatePayoutStatus(
    id,
    parsed.data.status,
    parsed.data.note,
  );
  if (!result.ok) return fail({ code: result.code }, 404);
  await writeAudit({
    actorId: admin.sub,
    action: `sellerPayout.${parsed.data.status}`,
    entityType: "SellerPayout",
    entityId: id,
    after: { status: parsed.data.status },
  });
  return ok({ status: parsed.data.status });
}
