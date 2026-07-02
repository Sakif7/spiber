import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { sellerPayoutCreateSchema } from "@/lib/schemas/seller-commission";
import { createSellerPayout } from "@/lib/services/seller-commission.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

/** Create a payout for a seller from a set of accrued commissions. */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const parsed = await parseJson(req, sellerPayoutCreateSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const result = await createSellerPayout(
    parsed.data.sellerId,
    parsed.data.commissionIds,
    parsed.data.note,
  );
  if (!result.ok) return fail({ code: result.code }, 400);
  await writeAudit({
    actorId: admin.sub,
    action: "sellerPayout.create",
    entityType: "SellerPayout",
    entityId: result.payoutId,
    after: { totalEarningsMinor: result.payout.totalEarningsMinor },
  });
  return ok({ payoutNumber: result.payout.payoutNumber });
}
