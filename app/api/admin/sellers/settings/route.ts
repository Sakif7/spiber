import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { globalCommissionSchema } from "@/lib/schemas/seller";
import { setSellerCommissionBp } from "@/lib/services/seller-settings.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

/** Set the GLOBAL default seller commission rate (basis points). */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const parsed = await parseJson(req, globalCommissionSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  await setSellerCommissionBp(parsed.data.commissionBp);
  await writeAudit({
    actorId: admin.sub,
    action: "seller.globalCommission",
    entityType: "Setting",
    after: { commissionBp: parsed.data.commissionBp },
  });
  return ok({ commissionBp: parsed.data.commissionBp });
}
