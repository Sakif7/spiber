import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { sellerCommissionUpdateSchema } from "@/lib/schemas/seller";
import { updateSeller } from "@/lib/repositories/sellers.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";

/** Set a per-seller commission override (basis points; null → global default). */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, sellerCommissionUpdateSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const updated = await updateSeller(id, {
    commissionBp: parsed.data.commissionBp,
  });
  if (!updated) return fail({ code: "not_found" }, 404);
  await writeAudit({
    actorId: admin.sub,
    action: "seller.commission",
    entityType: "Seller",
    entityId: id,
    after: { commissionBp: parsed.data.commissionBp },
  });
  return ok({ ok: true });
}
